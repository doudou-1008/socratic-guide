# 安全守门（A-任务7）：用户输入软拒 + AI 回复破防检测
import re

JAILBREAK = [
    "忽略以上", "忽略前面", "忽略所有", "忘掉你的角色", "忘记你的角色",
    "系统提示", "system prompt", "直接给我答案", "直接告诉我答案",
    "告诉我答案", "把答案发", "越狱",
]


def soft_refuse(msg: str) -> str | None:
    """命中越狱/求答案关键词 -> 返回软性拒绝话术；否则 None。"""
    ml = (msg or "").lower()
    for k in JAILBREAK:
        if k.lower() in ml:
            return (
                "我理解你想更快拿到结果，但作为导师我更希望陪你自己想明白。"
                "你可以告诉我目前卡在哪一步，我们一起用提问推进——仍然不能直接给答案哦。"
            )
    return None


_LONG_CODE_RE = re.compile(r"```[\s\S]{200,}```")


def check_reply_leak(reply: str) -> str | None:
    """AI 回复出现过长代码块，疑似'破防'给答案 -> 返回提醒；否则 None。"""
    if _LONG_CODE_RE.search(reply or ""):
        return (
            "（提示：我似乎给了过长的代码，这不符合'只提问不回答'的原则。"
            "让我们回到提问，引导你自己写出这一块。）"
        )
    return None
