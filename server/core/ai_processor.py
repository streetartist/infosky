from .settings import settings
import json
import openai
from openai import AsyncOpenAI
from typing import AsyncGenerator

import traceback

class AIProcessor:
    def __init__(self):
        self._init_client()

    def _init_client(self):
        print(f"DEBUG: _init_client called. Using Key: {settings.openai_api_key[:3] if settings.openai_api_key else 'Placeholder'}...")
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key or "sk-placeholder",
            base_url=settings.openai_base_url,
            timeout=float(settings.OPENAI_TIMEOUT),
            max_retries=settings.OPENAI_MAX_RETRIES
        )

    def _check_and_reinit_client(self):
        """Re-init client if settings have changed."""
        current_base = str(self.client.base_url).rstrip('/')
        setting_base = settings.openai_base_url.rstrip('/')
        
        if (self.client.api_key != settings.openai_api_key) or \
           (current_base != setting_base) or \
           (self.client.max_retries != settings.OPENAI_MAX_RETRIES):
            print(f"DEBUG: AIProcessor detected config change. Re-initializing client.")
            self._init_client()

    async def extract_knowledge(self, text: str, existing_labels: list[str] = None):
        """
        Extracts nodes and edges from text using an LLM.
        Uses streaming internally to avoid timeout, but returns complete result.
        """
        self._check_and_reinit_client()

        # Fail fast if no valid key
        if not settings.openai_api_key or settings.openai_api_key == "sk-placeholder" or "placeholder" in self.client.api_key:
             return [
                 {"label": "配置缺失", "type": "System", "content": "请点击右上角设置图标，配置您的 OpenAI/Deepseek API Key 以启用 AI 分析功能。"}
             ], []

        if not text.strip():
            return [], []

        # Construct Context String
        context_instruction = ""
        if existing_labels:
            labels_str = ", ".join(existing_labels[:50]) # Limit to 50 to avoid token overflow
            context_instruction = f"""
## 现有知识库上下文 (可选参考)

当前知识库中已存在以下概念（供参考，不强制使用）：
[{labels_str}]

**处理原则**：
- 如果输入内容中明确提到了上述现有概念，或与其有**直接、明确的逻辑关系**，可以：
  1. 使用相同的Label名称（触发内容更新）
  2. 在edges中建立连接
- 如果没有直接关联，**不要强行建立联系**。独立的新知识也是有价值的。
- 请根据实际语义判断，而非机械匹配关键词。
"""

        system_prompt = f"""
你是一个知识提取助手。从用户输入中提取有价值的知识节点和它们之间的关系。

{context_instruction}

## 提取原则

### 节点提取
1. **识别核心概念**：主题、术语、实体（人物、组织、工具、理论等）
2. **提取有价值的信息**：定义、特征、方法、案例等
3. **保持独立性**：每个节点应该是一个独立的知识单元

### 关系识别
**只在存在真实语义关系时才创建边**，常见关系类型：
- 层次：属于、包含、组成
- 因果：导致、影响、依赖
- 时序：先于、继承
- 语义：定义为、又称

### 重要提示
- **不要强行关联**：如果输入内容与现有概念没有直接关系，就只提取新节点，不需要创建指向现有概念的边
- **质量优先**：宁可少提取几个高质量节点，也不要提取大量低质量或勉强关联的内容
- 孤立节点是允许的，如果它本身有价值

## 输出格式

返回纯JSON：
{{
    "nodes": [
        {{
            "label": "概念名称（2-6字）",
            "type": "核心概念|理论|工具|人物|事件|属性|方法|案例|领域",
            "content": "详细描述（50字以上，包含定义和关键特征）"
        }}
    ],
    "edges": [
        {{
            "source_label": "源节点",
            "target_label": "目标节点", 
            "relation_type": "关系类型"
        }}
    ]
}}

如果没有合适的边需要创建，edges可以是空数组[]。
"""


        try:
            # Use streaming to avoid timeout
            stream = await self.client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
                stream=True
            )
            
            content = ""
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    content += chunk.choices[0].delta.content
            
            # Clean content if it contains markdown code blocks
            clean_content = content
            if "```" in clean_content:
                import re
                clean_content = re.sub(r'^```json\s*', '', clean_content, flags=re.MULTILINE)
                clean_content = re.sub(r'^```\s*', '', clean_content, flags=re.MULTILINE)
                clean_content = re.sub(r'```$', '', clean_content, flags=re.MULTILINE)
                clean_content = clean_content.strip()

            try:
                data = json.loads(clean_content)
            except json.JSONDecodeError as e:
                print(f"JSON Parse Error: {e}")
                print(f"Raw Content that failed to parse: {content}")
                # Attempt to repair or partial parse could go here, but for now just fail gracefully with info
                return [
                    {"label": "格式错误", "type": "Error", "content": f"AI返回格式异常，无法解析。原始返回: {content[:100]}..."}
                ], []

            nodes = data.get("nodes", [])
            edges = data.get("edges", [])
            
            # Validate structure
            if not isinstance(nodes, list):
                print(f"Invalid nodes format: {type(nodes)}")
                nodes = []
            if not isinstance(edges, list):
                 print(f"Invalid edges format: {type(edges)}")
                 edges = []

            return nodes, edges
            
        except openai.AuthenticationError as ae:
            print(f"AI Auth Error: {ae}")
            return [
                {"label": "认证失败", "type": "Error", "content": "API Key 无效或过期。请检查设置。\n详细信息: " + str(ae)}
            ], []
        except Exception as e:
            print(f"AI Processing Error: {e}")
            traceback.print_exc() # Print full stack trace
            # Fallback for demo if no API key or error
            return [
                {"label": "处理失败", "type": "Error", "content": f"AI处理遇到问题: {str(e)}"}
            ], [{"source_label": "错误", "target_label": "处理失败", "relation_type": "导致"}]

    async def answer_question_stream(self, question: str, context: str) -> AsyncGenerator[str, None]:
        """
        Answer user question based on context using streaming.
        Yields chunks of the answer as they arrive.
        """
        self._check_and_reinit_client()
        
        # Fail fast if no valid key
        if not settings.openai_api_key or settings.openai_api_key == "sk-placeholder":
            yield "请先配置 API Key 以使用问答功能。"
            return

        system_prompt = f"""
        你如果不只是一个知识助手，更是用户的"第二大脑"。
        请根据以下提供的【用户笔记/知识库上下文】，回答用户的问题。
        
        【规则】：
        1. **仅依据上下文回答**：不要编造事实。如果上下文中没有答案，请直接说"知识库中暂时没有相关记录"。
        2. **引用来源**：如果引用了某个具体的笔记，请简要提及（例如："根据您关于...的笔记"）。
        3. **语言风格**：亲切、专业、简洁。
        
        【上下文】：
        {context}
        """

        try:
            stream = await self.client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question}
                ],
                temperature=0.5,
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            yield f"AI 回答失败: {str(e)}"

    async def answer_question(self, question: str, context: str) -> str:
        """
        Non-streaming version for backward compatibility.
        Collects all chunks and returns the full answer.
        """
        full_answer = ""
        async for chunk in self.answer_question_stream(question, context):
            full_answer += chunk
        return full_answer

    async def summarize_content(self, raw_content: str, url: str = None):
        """
        Cleans and organizes web content for storage in Knowledge Base.
        Preserves original text but removes noise and improves formatting.
        Uses streaming internally to avoid timeout.
        """
        self._check_and_reinit_client()
        
        if not settings.openai_api_key or settings.openai_api_key == "sk-placeholder":
            return raw_content[:8000]  # Fallback to truncation if no API key

        system_prompt = """
        你是一个内容整理助手。请对以下网页内容进行**清理和格式化**，但**保留原文内容**。

        **任务**：
        1. **保留原文**：保持作者的原始表述，不要概括或删减正文内容
        2. **删除噪声**：移除广告、导航菜单、评论区、社交分享按钮等无关内容
        3. **修复格式**：使用 Markdown 格式化，让内容更易阅读
        4. **提取标题**：识别并标注文章的标题和小标题

        **输出格式**：
        直接输出整理后的原文内容，使用 Markdown 格式。
        - 一级标题用 #
        - 二级标题用 ##
        - 代码块用 ```
        - 列表用 - 或数字

        注意：**不要概括**，**不要省略原文**，只是清理和格式化。
        """

        try:
            # Use streaming to avoid timeout
            stream = await self.client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"请整理以下网页内容（保留原文，只清理格式）：\n\n{raw_content[:12000]}"}
                ],
                temperature=0.2,
                max_tokens=4000,
                stream=True
            )
            
            # Collect all chunks
            content = ""
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    content += chunk.choices[0].delta.content
            
            return content
        except Exception as e:
            print(f"AI Content Cleaning failed: {e}")
            return raw_content[:8000]  # Fallback


ai_processor = AIProcessor()
