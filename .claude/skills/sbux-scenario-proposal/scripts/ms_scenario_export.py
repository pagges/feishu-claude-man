#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MeterSphere 场景导出
通过 export API 获取场景完整定义（包含 scenarioDefinition）
"""

import argparse
import base64
import json
import sys
import time
from typing import Dict, List, Optional, Any

try:
    import requests
except ImportError:
    print("Error: requests module not found. Please install: pip3 install requests", file=sys.stderr)
    sys.exit(1)

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import padding
except ImportError:
    print("Error: cryptography module not found. Please install: pip3 install cryptography", file=sys.stderr)
    sys.exit(1)


def generate_signature(access_key: str, secret_key: str) -> str:
    """生成 API 签名（AES-128-CBC）"""
    timestamp = str(int(time.time() * 1000))
    plain_text = f"{access_key}|{timestamp}"

    key = secret_key.encode('utf-8')[:16].ljust(16, b'\x00')
    iv = access_key.encode('utf-8')[:16].ljust(16, b'\x00')

    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(plain_text.encode('utf-8')) + padder.finalize()

    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    encrypted = encryptor.update(padded_data) + encryptor.finalize()

    return base64.b64encode(encrypted).decode('utf-8')


def export_scenario(base_url: str, access_key: str, secret_key: str, scenario_id: str) -> Optional[Dict]:
    """通过 export API 获取场景完整定义"""
    url = f"{base_url}/api/api/automation/export"

    headers = {
        "accessKey": access_key,
        "signature": generate_signature(access_key, secret_key),
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, headers=headers, json={"ids": [scenario_id]}, timeout=60)
        response.raise_for_status()
        data = response.json()

        if data.get("success"):
            scenarios = data.get("data", {}).get("data", [])
            if scenarios:
                return scenarios[0]
        else:
            print(f"Error: {data.get('message')}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error exporting scenario: {e}", file=sys.stderr)
        return None


def parse_scenario_to_steps(scenario: Dict) -> List[Dict]:
    """解析场景定义，提取步骤详情"""
    steps = []

    scenario_def = scenario.get("scenarioDefinition")
    if isinstance(scenario_def, str):
        scenario_def = json.loads(scenario_def)

    if not scenario_def:
        return steps

    hash_tree = scenario_def.get("hashTree", [])

    for idx, step in enumerate(hash_tree, 1):
        step_type = step.get("type", "")
        step_data = {
            "step_order": idx,
            "step_type": step_type,
            "step_name": step.get("name", ""),
            "api_path": step.get("path", ""),
            "api_method": step.get("method", ""),
            "headers": [],
            "body": "",
            "body_type": "",
            "assertions": [],
            "extract_vars": [],
            "pre_script": "",
            "post_script": "",
            "jdbc_query": "",
            "jdbc_variables": "",
        }

        # 解析 HTTP 请求
        if step_type == "HTTPSamplerProxy":
            # Headers
            headers_list = step.get("headers", [])
            step_data["headers"] = [
                {"name": h.get("name", ""), "value": h.get("value", ""), "enable": h.get("enable", True)}
                for h in headers_list if h.get("name")
            ]

            # Body
            body = step.get("body", {})
            step_data["body_type"] = body.get("type", "JSON")
            step_data["body"] = body.get("raw", "")

            # 解析子节点（前置脚本、断言、变量提取等）
            for sub in step.get("hashTree", []):
                sub_type = sub.get("type", "")

                if sub_type == "JSR223PreProcessor":
                    step_data["pre_script"] = sub.get("script", "")

                elif sub_type == "JSR223PostProcessor":
                    step_data["post_script"] = sub.get("script", "")

                elif sub_type == "JDBCPostProcessor":
                    step_data["jdbc_query"] = sub.get("query", "")
                    step_data["jdbc_variables"] = sub.get("variableNames", "")

                elif sub_type == "Assertions":
                    # JSON 断言
                    for jp in sub.get("jsonPath", []):
                        step_data["assertions"].append({
                            "type": "JSON",
                            "expression": jp.get("expression", ""),
                            "expect": jp.get("expect", ""),
                            "option": jp.get("option", "EQUALS")
                        })
                    # 正则断言
                    for rx in sub.get("regex", []):
                        step_data["assertions"].append({
                            "type": "Regex",
                            "expression": rx.get("expression", ""),
                            "subject": rx.get("subject", ""),
                        })
                    # JSR223 断言
                    for jsr in sub.get("jsr223", []):
                        if jsr.get("script"):
                            step_data["assertions"].append({
                                "type": "Script",
                                "script": jsr.get("script", ""),
                                "name": jsr.get("name", "")
                            })

                elif sub_type == "Extract":
                    for j in sub.get("json", []):
                        step_data["extract_vars"].append({
                            "name": j.get("variable", ""),
                            "expression": j.get("expression", ""),
                            "type": "JSONPath"
                        })

        # 解析 JDBC 采样器
        elif step_type in ["JDBCSampler", "JDBCPostProcessor"]:
            step_data["jdbc_query"] = step.get("query", "")
            step_data["jdbc_variables"] = step.get("variableNames", "")
            step_data["api_path"] = f"[{step.get('dataSourceId', '')}]"

            # 解析子节点断言
            for sub in step.get("hashTree", []):
                if sub.get("type") == "Assertions":
                    for jsr in sub.get("jsr223", []):
                        if jsr.get("script"):
                            step_data["assertions"].append({
                                "type": "Script",
                                "script": jsr.get("script", ""),
                                "name": jsr.get("name", "")
                            })

        steps.append(step_data)

    return steps


def main():
    parser = argparse.ArgumentParser(description="Export MeterSphere scenario with full definition")
    parser.add_argument("--base-url", required=True, help="MeterSphere base URL")
    parser.add_argument("--access-key", required=True, help="API access key")
    parser.add_argument("--secret-key", required=True, help="API secret key")
    parser.add_argument("--scenario-id", required=True, help="Scenario ID")
    parser.add_argument("--format", choices=["full", "steps", "summary"], default="full",
                        help="Output format: full (complete JSON), steps (parsed steps), summary (basic info)")

    args = parser.parse_args()

    scenario = export_scenario(args.base_url, args.access_key, args.secret_key, args.scenario_id)

    if not scenario:
        sys.exit(1)

    if args.format == "full":
        print(json.dumps(scenario, ensure_ascii=False, indent=2))

    elif args.format == "steps":
        steps = parse_scenario_to_steps(scenario)
        print(json.dumps(steps, ensure_ascii=False, indent=2))

    elif args.format == "summary":
        scenario_def = scenario.get("scenarioDefinition")
        if isinstance(scenario_def, str):
            scenario_def = json.loads(scenario_def)

        summary = {
            "id": scenario.get("id"),
            "num": scenario.get("num"),
            "name": scenario.get("name"),
            "level": scenario.get("level"),
            "status": scenario.get("status"),
            "modulePath": scenario.get("modulePath"),
            "stepTotal": scenario.get("stepTotal"),
            "variables": scenario_def.get("variables", []) if scenario_def else [],
            "steps": []
        }

        if scenario_def:
            for idx, step in enumerate(scenario_def.get("hashTree", []), 1):
                summary["steps"].append({
                    "order": idx,
                    "type": step.get("type", ""),
                    "name": step.get("name", ""),
                    "path": step.get("path", "") or step.get("query", "")[:50]
                })

        print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
