#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MeterSphere 场景执行
"""

import argparse
import base64
import json
import sys
import time

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


def run_scenarios(base_url: str, access_key: str, secret_key: str,
                  project_id: str, scenario_ids: list, report_name: str,
                  mode: str = "serial", resource_pool_id: str = None,
                  environment_id: str = None):
    """执行测试场景"""
    url = f"{base_url}/api/api/automation/run"

    headers = {
        "accessKey": access_key,
        "signature": generate_signature(access_key, secret_key),
        "Content-Type": "application/json"
    }

    payload = {
        "projectId": project_id,
        "scenarioIds": scenario_ids,
        "reportName": report_name,
        "runMode": mode
    }

    if resource_pool_id:
        payload["resourcePoolId"] = resource_pool_id
    if environment_id:
        payload["environmentId"] = environment_id

    response = requests.post(url, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()

    if data.get("success"):
        return data.get("data", {}).get("reportId")
    else:
        raise Exception(data.get("message", "Unknown error"))


def get_report(base_url: str, access_key: str, secret_key: str, report_id: str):
    """获取测试报告"""
    url = f"{base_url}/api/api/automation/report/get/{report_id}"

    headers = {
        "accessKey": access_key,
        "signature": generate_signature(access_key, secret_key),
        "Content-Type": "application/json"
    }

    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    data = response.json()

    if data.get("success"):
        return data.get("data")
    else:
        raise Exception(data.get("message", "Unknown error"))


def wait_for_report(base_url: str, access_key: str, secret_key: str,
                    report_id: str, timeout: int = 600):
    """等待报告完成"""
    start_time = time.time()

    while True:
        report = get_report(base_url, access_key, secret_key, report_id)
        status = report.get("status")

        if status in ["Success", "Error", "Completed", "Failed", "success", "error"]:
            return report

        if time.time() - start_time > timeout:
            print(f"Timeout waiting for report", file=sys.stderr)
            return report

        time.sleep(5)


def main():
    parser = argparse.ArgumentParser(description="Run MeterSphere test scenarios")
    parser.add_argument("--base-url", required=True, help="MeterSphere base URL")
    parser.add_argument("--access-key", required=True, help="API access key")
    parser.add_argument("--secret-key", required=True, help="API secret key")
    parser.add_argument("--project-id", required=True, help="Project ID")
    parser.add_argument("--ids", required=True, help="Comma-separated scenario IDs")
    parser.add_argument("--report-name", help="Report name")
    parser.add_argument("--mode", choices=["serial", "parallel"], default="serial",
                        help="Execution mode")
    parser.add_argument("--resource-pool-id", help="Resource pool ID")
    parser.add_argument("--environment-id", help="Environment ID")
    parser.add_argument("--wait", action="store_true", help="Wait for completion")
    parser.add_argument("--timeout", type=int, default=600, help="Timeout in seconds")

    args = parser.parse_args()

    scenario_ids = [id.strip() for id in args.ids.split(",") if id.strip()]
    report_name = args.report_name or f"Scenario Run {time.strftime('%Y-%m-%d %H:%M:%S')}"

    try:
        report_id = run_scenarios(
            args.base_url, args.access_key, args.secret_key,
            args.project_id, scenario_ids, report_name,
            args.mode, args.resource_pool_id, args.environment_id
        )

        if args.wait:
            print(f"Waiting for report {report_id}...", file=sys.stderr)
            report = wait_for_report(
                args.base_url, args.access_key, args.secret_key,
                report_id, args.timeout
            )
            print(json.dumps(report, ensure_ascii=False, indent=2))
        else:
            print(json.dumps({"reportId": report_id}, ensure_ascii=False))

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
