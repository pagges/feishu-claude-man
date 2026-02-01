#!/usr/bin/env python3
"""
Trace ID 链路查询脚本 (Trace Query Skill)
功能：通过 SRE AIOps API 查询完整调用链路，包含 Ingress、Services 和 Kong 网关日志
"""

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone

try:
    import requests
except ImportError:
    print("缺少 requests 库，请执行: pip install requests", file=sys.stderr)
    sys.exit(1)


def calculate_date_range(days: int) -> tuple[str, str]:
    """
    计算查询时间范围

    Args:
        days: 查询最近多少天

    Returns:
        (start_time, end_time) 元组，格式为 ISO8601
    """
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    start_time = start_date.strftime('%Y-%m-%dT00:00:00.000Z')
    end_time = now.strftime('%Y-%m-%dT23:59:59.999Z')

    return start_time, end_time


def execute_query(trace_id: str, env: str, start_time: str, end_time: str, base_url: str) -> bool:
    """
    执行 Trace ID 查询，结果输出到 stdout

    Args:
        trace_id: Trace ID
        env: 环境 (prod/stg)
        start_time: 开始时间
        end_time: 结束时间
        base_url: API 基础地址

    Returns:
        查询是否成功
    """
    url = f"{base_url}/api/v2/get-traceid"

    payload = {
        "x-transaction-id": trace_id,
        "env": env,
        "startTime": start_time,
        "endTime": end_time
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    try:
        # 跳过 SSL 验证（企业内网常用自签名证书）
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=(10, 60),
            verify=False
        )

        if response.status_code != 200:
            print(f"请求失败，状态码: {response.status_code}", file=sys.stderr)
            print(f"响应内容: {response.text}", file=sys.stderr)
            return False

        data = response.json()

        if 'error' in data:
            print(f"查询返回错误：{json.dumps(data, indent=2, ensure_ascii=False)}", file=sys.stderr)
            return False

        # 提取核心数据
        result = data.get('data', {})

        if not result:
            print("查询结果为空，请检查 Trace ID 是否正确", file=sys.stderr)
            return True

        # 格式化输出结果
        output = format_output(result)
        print(output)

        return True

    except requests.exceptions.Timeout:
        print("查询超时，请检查网络连接", file=sys.stderr)
        return False
    except requests.exceptions.ConnectionError:
        print("连接失败，请检查网络连接和 VPN 状态", file=sys.stderr)
        return False
    except requests.exceptions.RequestException as e:
        print(f"查询失败：{e}", file=sys.stderr)
        return False
    except json.JSONDecodeError:
        print("响应解析失败，返回的不是有效 JSON", file=sys.stderr)
        return False


def format_output(data: dict) -> str:
    """
    格式化输出查询结果

    Args:
        data: API 返回的数据

    Returns:
        格式化的字符串
    """
    output_lines = []

    # Ingress 链路
    ingress = data.get('ingress', {})
    ingress_data = ingress.get('data', [])
    if ingress_data:
        output_lines.append("=" * 80)
        output_lines.append("【Ingress 链路】")
        output_lines.append("=" * 80)
        for i, item in enumerate(ingress_data, 1):
            output_lines.append(f"\n--- 请求 {i} ---")
            output_lines.append(f"Host: {item.get('host', 'N/A')}")
            output_lines.append(f"Method: {item.get('method', 'N/A')}")
            output_lines.append(f"Path: {item.get('path', 'N/A')}")
            output_lines.append(f"Response Code: {item.get('response_code', 'N/A')}")
            output_lines.append(f"Duration: {item.get('duration', 'N/A')}s")
            output_lines.append(f"Service: {item.get('service_name', 'N/A')}")
            output_lines.append(f"Namespace: {item.get('namespace', 'N/A')}")
            output_lines.append(f"Pod: {item.get('pod_addr', 'N/A')}")
            output_lines.append(f"Start Time: {item.get('startTime', 'N/A')}")

            # 详细日志信息
            logs = item.get('logs', {})
            if logs:
                output_lines.append(f"Transaction ID: {logs.get('x_transaction_id', 'N/A')}")
                output_lines.append(f"Request ID: {logs.get('request_id', 'N/A')}")

    # Kong 网关
    kong = data.get('kong', {})
    kong_data = kong.get('data', [])
    if kong_data:
        output_lines.append("\n" + "=" * 80)
        output_lines.append("【Kong 网关】")
        output_lines.append("=" * 80)
        for i, item in enumerate(kong_data, 1):
            output_lines.append(f"\n--- 记录 {i} ---")
            output_lines.append(f"Host: {item.get('host', 'N/A')}")

            message = item.get('message', {})
            if message:
                # 请求信息
                request = message.get('request', {})
                if request:
                    output_lines.append(f"Method: {request.get('method', 'N/A')}")
                    output_lines.append(f"URI: {request.get('uri', 'N/A')}")

                # 响应信息
                response = message.get('response', {})
                if response:
                    output_lines.append(f"Response Status: {response.get('status', 'N/A')}")

                # 延迟信息
                latencies = message.get('latencies', {})
                if latencies:
                    output_lines.append(f"Latency - Kong: {latencies.get('kong', 'N/A')}ms")
                    output_lines.append(f"Latency - Proxy: {latencies.get('proxy', 'N/A')}ms")
                    output_lines.append(f"Latency - Request: {latencies.get('request', 'N/A')}ms")

                # Consumer 信息
                consumer = message.get('consumer', {})
                if consumer:
                    output_lines.append(f"Consumer: {consumer.get('username', 'N/A')}")

    # Services 服务日志
    services = data.get('services', {})
    services_data = services.get('data', [])
    if services_data:
        output_lines.append("\n" + "=" * 80)
        output_lines.append("【Services 服务日志】")
        output_lines.append("=" * 80)
        for i, item in enumerate(services_data, 1):
            output_lines.append(f"\n--- 服务 {i}: {item.get('host', 'N/A')} ---")
            output_lines.append(f"Index: {item.get('index', 'N/A')}")

            logs = item.get('logs', [])
            if logs:
                output_lines.append(f"日志条数: {len(logs)}")
                for j, log in enumerate(logs[:10], 1):  # 只显示前10条
                    output_lines.append(f"\n  [{j}] {log.get('@timestamp', 'N/A')}")
                    message = log.get('message', log.get('log', 'N/A'))
                    if isinstance(message, str) and len(message) > 500:
                        message = message[:500] + "..."
                    output_lines.append(f"      {message}")

                if len(logs) > 10:
                    output_lines.append(f"\n  ... 还有 {len(logs) - 10} 条日志未显示")

    # 汇总信息
    output_lines.append("\n" + "=" * 80)
    output_lines.append("【汇总】")
    output_lines.append("=" * 80)
    output_lines.append(f"Ingress 请求数: {len(ingress_data)}")
    output_lines.append(f"Kong 记录数: {len(kong_data)}")
    output_lines.append(f"Services 服务数: {len(services_data)}")

    return "\n".join(output_lines)


def main() -> None:
    """主程序入口"""
    parser = argparse.ArgumentParser(
        description='Trace ID 链路查询脚本，查询完整调用链路',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python3 trace-query.py --trace_id "1a13dc63-11e0-4277-9a1b-aa4c4d65f850" --env prod --days 1

  # 保存到文件
  python3 trace-query.py --trace_id "xxx" --env prod --days 1 > trace.log
"""
    )

    parser.add_argument('--trace_id', required=True, help='Trace ID')
    parser.add_argument('--env', required=True, choices=['prod', 'stg'], help='环境 (prod/stg)')
    parser.add_argument('--days', type=int, required=True, help='查询最近多少天内的数据')
    parser.add_argument('--base_url', default='https://sre-aiops.starbucks.net', help='API 基础地址')

    args = parser.parse_args()

    start_time, end_time = calculate_date_range(args.days)

    print(f"查询参数:", file=sys.stderr)
    print(f"  Trace ID: {args.trace_id}", file=sys.stderr)
    print(f"  环境: {args.env}", file=sys.stderr)
    print(f"  时间范围: {start_time} ~ {end_time}", file=sys.stderr)
    print("", file=sys.stderr)

    if not execute_query(args.trace_id, args.env, start_time, end_time, args.base_url):
        sys.exit(1)


if __name__ == '__main__':
    main()
