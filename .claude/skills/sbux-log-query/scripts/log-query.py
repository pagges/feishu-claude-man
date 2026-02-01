#!/usr/bin/env python3
"""
ES 日志查询脚本 (Log Query Skill)
功能：通过 ES 代理 API 查询日志，结果输出到 stdout
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
        days: 查询多少天前开始

    Returns:
        (start_time, end_time) 元组，格式为 ISO8601
    """
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    start_time = start_date.strftime('%Y-%m-%dT00:00:00.000Z')
    end_time = now.strftime('%Y-%m-%dT23:59:59.999Z')

    return start_time, end_time


def execute_query(index: str, keyword: str, start_time: str, end_time: str, size: int, base_url: str) -> bool:
    """
    执行 ES 查询，结果输出到 stdout

    Args:
        index: ES 索引
        keyword: 查询关键词，多个用逗号分隔
        start_time: 开始时间
        end_time: 结束时间
        size: 返回条数上限
        base_url: ES 代理地址

    Returns:
        查询是否成功
    """
    url = f"{base_url}/{index}/_search?pretty=true"

    # 解析多个 keywords
    keywords = [k.strip() for k in keyword.split(',') if k.strip()]

    # 构建 keyword 查询
    if len(keywords) == 1:
        # 单个关键词，保持原逻辑
        keyword_query = {
            "multi_match": {
                "type": "phrase",
                "query": keywords[0],
                "lenient": True
            }
        }
    else:
        # 多个关键词，使用 bool should (OR)
        keyword_query = {
            "bool": {
                "should": [
                    {"multi_match": {"type": "phrase", "query": kw, "lenient": True}}
                    for kw in keywords
                ],
                "minimum_should_match": 1
            }
        }

    query_json = {
        "query": {
            "bool": {
                "filter": [
                    keyword_query,
                    {
                        "range": {
                            "@timestamp": {
                                "format": "strict_date_optional_time",
                                "gte": start_time,
                                "lte": end_time
                            }
                        }
                    }
                ]
            }
        },
        "_source": ["log", "message"],
        "size": size,
        "sort": [{"@timestamp": {"order": "desc"}}]
    }

    try:
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json=query_json,
            timeout=(10, 30),
            proxies={"http": None, "https": None}  # 禁用代理，直连内网服务
        )

        data = response.json()

        if 'error' in data:
            print(f"查询返回错误：{json.dumps(data, indent=2, ensure_ascii=False)}", file=sys.stderr)
            return False

        hits = data.get('hits', {}).get('hits', [])

        if not hits:
            print("查询结果为空，没有匹配的日志", file=sys.stderr)
            return True

        # 提取并输出日志内容到 stdout
        for hit in hits:
            source = hit.get('_source', {})
            log_content = source.get('log') or source.get('message')
            if log_content:
                print(log_content)

        return True

    except requests.exceptions.Timeout:
        print("查询超时，请检查网络连接", file=sys.stderr)
        return False
    except requests.exceptions.ConnectionError:
        print("连接失败，请检查 ES 服务是否正常", file=sys.stderr)
        return False
    except requests.exceptions.RequestException as e:
        print(f"查询失败：{e}", file=sys.stderr)
        return False
    except json.JSONDecodeError:
        print("响应解析失败，返回的不是有效 JSON", file=sys.stderr)
        return False


def main() -> None:
    """主程序入口"""
    parser = argparse.ArgumentParser(
        description='ES 日志查询脚本，结果输出到 stdout',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python3 log-query.py --keyword requestId123 --index "stg:*upp*" --days 0 --size 100 --base_url "http://arex.stg.sbuxcf.net/repeaterApi"

  # 保存到文件
  python3 log-query.py --keyword requestId123 --index "stg:*upp*" --days 0 --size 100 --base_url "http://arex.stg.sbuxcf.net/repeaterApi" > output.log
"""
    )

    parser.add_argument('--keyword', required=True, help='查询关键词，多个用逗号分隔')
    parser.add_argument('--index', required=True, help='ES 日志索引')
    parser.add_argument('--days', type=int, required=True, help='查询多少天内的日志（0=今天）')
    parser.add_argument('--size', type=int, required=True, help='返回条数上限')
    parser.add_argument('--base_url', required=True, help='ES 代理地址')

    args = parser.parse_args()

    start_time, end_time = calculate_date_range(args.days)

    if not execute_query(args.index, args.keyword, start_time, end_time, args.size, args.base_url):
        sys.exit(1)


if __name__ == '__main__':
    main()
