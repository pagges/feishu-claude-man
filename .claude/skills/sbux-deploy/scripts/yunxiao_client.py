import argparse
import json
import sys
import time
import urllib3
import requests

# 禁用 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def deploy(app_name, branch_name, base_url, org_id, token, stage_name, release_stage_name, comment):
    """发布应用并等待结果"""
    # 处理 URL 末尾斜杠
    base_url = base_url.rstrip("/")

    headers = {
        "accept": "*/*",
        "x-yunxiao-token": token,
        "Content-Type": "application/json"
    }

    # 1. 查询研发流程
    url = f"{base_url}/oapi/v1/appstack/organizations/{org_id}/apps/{app_name}/releaseWorkflows"
    try:
        response = requests.get(url, headers=headers, verify=False)
        response.raise_for_status()
        workflows = response.json()
    except requests.exceptions.RequestException as e:
        print(f"错误: 查询工作流失败 - {e}", flush=True)
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"错误: API 返回非 JSON 数据", flush=True)
        print(f"响应内容: {response.text[:500]}", flush=True)
        sys.exit(1)

    if not isinstance(workflows, list):
        print(f"错误: API 返回格式异常", flush=True)
        print(json.dumps(workflows, indent=2, ensure_ascii=False), flush=True)
        sys.exit(1)

    # 2. 找到目标工作流和阶段（统一使用小写匹配）
    workflow_sn, stage_sn = None, None
    stage_name_lower = stage_name.lower()
    release_stage_name_lower = release_stage_name.lower()

    for workflow in workflows:
        workflow_name = workflow.get("name", "").lower()
        if stage_name_lower in workflow_name:
            for stage in workflow.get("releaseStages", []):
                stage_name_in_workflow = stage.get("name", "").lower()
                if release_stage_name_lower in stage_name_in_workflow:
                    workflow_sn, stage_sn = workflow["sn"], stage["sn"]
                    break
            if workflow_sn:
                break

    if not workflow_sn or not stage_sn:
        if not workflow_sn:
            print(f"错误: 未找到工作流 '{stage_name}'", flush=True)
        else:
            print(f"错误: 在工作流 '{stage_name}' 中未找到阶段 '{release_stage_name}'", flush=True)
        print("可用的工作流和阶段:", flush=True)
        for w in workflows:
            print(f"  工作流: {w.get('name', 'N/A')}", flush=True)
            for s in w.get('releaseStages', []):
                print(f"    - 阶段: {s.get('name', 'N/A')}", flush=True)
        sys.exit(1)

    # 3. 执行发布
    url = f"{base_url}/oapi/v1/appstack/organizations/{org_id}/apps/{app_name}/releaseWorkflows/{workflow_sn}/releaseStages/{stage_sn}:execute"
    data = {"params": {"sdlc": branch_name, "FLOW_INST_RUNNING_COMMENT": comment, "branchRepoInfo": []}}

    try:
        response = requests.post(url, headers=headers, json=data, verify=False)
        response.raise_for_status()
        result = response.json()
    except requests.exceptions.RequestException as e:
        print(f"错误: 执行发布失败 - {e}", flush=True)
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"错误: 发布 API 返回非 JSON 数据", flush=True)
        print(f"响应内容: {response.text[:500]}", flush=True)
        sys.exit(1)

    pipeline_id = result.get("pipelineId")
    pipeline_run_id = result.get("pipelineRunId")
    if not pipeline_id:
        print(f"错误: 发布失败", flush=True)
        print(json.dumps(result, indent=2, ensure_ascii=False), flush=True)
        sys.exit(1)

    print(f"发布已启动: pipeline={pipeline_id}, run={pipeline_run_id}", flush=True)

    # 4. 等待结果
    url = f"{base_url}/oapi/v1/flow/organizations/{org_id}/pipelines/{pipeline_id}/runs/{pipeline_run_id}"
    timeout, interval = 1800, 10
    start_time = time.time()

    while time.time() - start_time < timeout:
        try:
            response = requests.get(url, headers=headers, verify=False)
            response.raise_for_status()
            result = response.json()
        except requests.exceptions.RequestException as e:
            print(f"警告: 查询状态失败 - {e}，重试中...", flush=True)
            time.sleep(interval)
            continue
        except json.JSONDecodeError:
            print(f"警告: 状态 API 返回非 JSON 数据，重试中...", flush=True)
            time.sleep(interval)
            continue

        status = result.get("status")
        print(f"状态: {status}", flush=True)

        if status == "SUCCESS":
            print("发布成功", flush=True)
            sys.exit(0)
        elif status in ["FAIL", "CANCELED"]:
            print(f"发布失败: {status}", flush=True)
            print(json.dumps(result, indent=2, ensure_ascii=False), flush=True)
            sys.exit(1)

        time.sleep(interval)

    print("错误: 超时", flush=True)
    sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="云效发布客户端")
    parser.add_argument("--app_name", required=True, help="应用名称")
    parser.add_argument("--branch_name", required=True, help="分支名称")
    parser.add_argument("--base_url", required=True, help="云效地址")
    parser.add_argument("--org_id", required=True, help="组织ID")
    parser.add_argument("--token", required=True, help="API Token")
    parser.add_argument("--stage_name", required=True, help="工作流名称")
    parser.add_argument("--release_stage_name", required=True, help="发布阶段名称")
    parser.add_argument("--comment", required=True, help="发布说明")

    args = parser.parse_args()

    deploy(
        app_name=args.app_name,
        branch_name=args.branch_name,
        base_url=args.base_url,
        org_id=args.org_id,
        token=args.token,
        stage_name=args.stage_name,
        release_stage_name=args.release_stage_name,
        comment=args.comment
    )
