// source/js/translate.js

function translateAIImpl() {
    class TranslateAI {
        constructor() {
            if (!this.checkDependencies()) return; // 检查依赖项
            this.initVariables();
            if (!this.setupUI()) return; // 设置UI并检查元素是否存在
            this.addEventListeners();
            this.updateModelNameDisplay(); // 初始化显示模型名称
            console.log(`Translate AI v${this.version} initialized.`);
        }

        // 检查必要的依赖项（例如，如果使用了外部库）
        checkDependencies() {
            // 示例：如果依赖某个全局对象或函数
            // if (typeof someDependency === 'undefined') {
            //     console.error("Translate AI Error: Missing dependency 'someDependency'.");
            //     return false;
            // }
            return true;
        }

        initVariables() {
            this.version = '1.0.1'; // 版本更新
            this.aiConfig = {
                api: 'https://gemini-proxy.icjlu.eu.org/v1/chat/completions', // 确认这是正确的、可用的 API 端点
                model: 'gemini-1.5-flash-latest', // 可以选用更新或更适合翻译的模型
                modelDisplayName: 'Gemini 1.5 Flash', // 更新显示名称
                temperature: 0.5, // 翻译通常用稍低温度以求准确
                headers: { 'Content-Type': 'application/json' }, // 可能需要添加授权头 'Authorization': 'Bearer YOUR_API_KEY'
                stream: true,
            };

            // UI 元素选择器
            this.sourceTextareaSelector = '#sourceText';
            this.targetLanguageSelectSelector = '#targetLanguage';
            this.translateButtonSelector = '#translateButton';
            this.translatedTextElementSelector = '#translatedText';
            this.modelNameElementSelector = '.ai-summary-card .ai-summary-model-name';
            this.resultCardSelector = '.ai-summary-card'; // 用于显示/隐藏卡片

            // UI 元素引用
            this.sourceTextarea = null;
            this.targetLanguageSelect = null;
            this.translateButton = null;
            this.translatedTextElement = null;
            this.modelNameElement = null;
            this.resultCard = null;

            this.isLoading = false; // 防止重复点击
        }

        setupUI() {
            this.sourceTextarea = document.querySelector(this.sourceTextareaSelector);
            this.targetLanguageSelect = document.querySelector(this.targetLanguageSelectSelector);
            this.translateButton = document.querySelector(this.translateButtonSelector);
            this.translatedTextElement = document.querySelector(this.translatedTextElementSelector);
            this.modelNameElement = document.querySelector(this.modelNameElementSelector);
            this.resultCard = document.querySelector(this.resultCardSelector);

            if (!this.sourceTextarea || !this.targetLanguageSelect || !this.translateButton || !this.translatedTextElement || !this.modelNameElement || !this.resultCard) {
                console.error("AI Translate Error: One or more required UI elements were not found. Please check HTML structure and selectors:", {
                    sourceTextarea: !!this.sourceTextarea,
                    targetLanguageSelect: !!this.targetLanguageSelect,
                    translateButton: !!this.translateButton,
                    translatedTextElement: !!this.translatedTextElement,
                    modelNameElement: !!this.modelNameElement,
                    resultCard: !!this.resultCard
                });
                if(this.translateButton) this.translateButton.disabled = true;
                // 可以考虑隐藏整个翻译控件或显示错误消息
                return false; // Setup failed
            }
            // 初始隐藏结果卡片可能更好，或者至少清空初始内容
            // this.resultCard.style.display = 'none'; // 或者用 class 控制
            this.translatedTextElement.textContent = '等待输入并开始翻译...'; // 确保初始状态
            return true; // UI setup successful
        }

        updateModelNameDisplay() {
             if (this.modelNameElement && this.aiConfig.modelDisplayName) {
                this.modelNameElement.textContent = this.aiConfig.modelDisplayName;
             } else if (this.modelNameElement) {
                this.modelNameElement.textContent = 'AI模型'; // Fallback
             }
        }

        addEventListeners() {
             if (this.translateButton) {
                 this.translateButton.addEventListener('click', this.onTranslateClick.bind(this));
                 // 可选：在文本域按 Enter (或 Ctrl+Enter) 时触发翻译
                 // this.sourceTextarea.addEventListener('keydown', (event) => {
                 //     if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                 //         this.onTranslateClick();
                 //     }
                 // });
             } else {
                 console.warn("Translate AI: Translate button not found, cannot add event listener.");
             }
        }

        // 改进流式响应处理
        async handleStreamResponse(response, textElement) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let buffer = ""; // 用于处理跨块的JSON对象

            textElement.innerHTML = ''; // 清空之前的任何内容

            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // 按行处理 SSE 数据
                    let lines = buffer.split('\n');
                    buffer = lines.pop(); // 最后一行可能不完整，放回缓冲区

                    for (const line of lines) {
                        if (line.startsWith('data:')) {
                            const dataStr = line.substring(5).trim();
                            if (dataStr === '[DONE]') { // 检查结束信号 (如果API使用)
                                break; // 流结束
                            }
                            try {
                                const data = JSON.parse(dataStr);
                                // 检查多种可能的路径获取内容
                                const chunkContent = data?.choices?.[0]?.delta?.content ||
                                                     data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                                                     data?.text || // 有些API可能直接返回 text
                                                     ''; // 添加更多可能的路径或默认空字符串

                                if (chunkContent) {
                                    fullText += chunkContent;
                                    // 实时更新显示 (简单方式：替换全文，如果需要逐字效果，参考原 typeCharByCharFadeIn)
                                    // 为了避免频繁重绘，可以累积一定量再更新，或使用更复杂的流式渲染
                                    // 暂时保持收集完再显示，以重用现有动画函数
                                    // console.log("Chunk:", chunkContent); // 调试用
                                }
                            } catch (e) {
                                console.warn("Error parsing stream JSON chunk:", e, "Data:", dataStr);
                                // 忽略无法解析的行，继续处理下一行
                            }
                        }
                    }
                }

                // 处理缓冲区中剩余的数据（理论上应该很少）
                if (buffer.startsWith('data:')) {
                    // ... 尝试解析 buffer ...
                }

            } catch (error) {
                console.error("Error reading stream:", error);
                throw new Error("读取翻译结果流时出错。"); // 抛出更友好的错误
            } finally {
                 // 确保流完全关闭
                 // reader.releaseLock(); // 如果需要
            }

            if (!fullText.trim() && response.ok) {
                 // API 成功返回但内容为空
                 console.warn("Stream finished but no text content was extracted.");
                 return "翻译结果为空。"; // 返回提示信息
            } else if (!fullText.trim() && !response.ok){
                 // 如果流读取出错导致 fullText 为空
                 throw new Error("未能从流中获取翻译结果。");
            }

            return fullText;
        }

        async handleJsonResponse(response) {
             try {
                 const data = await response.json();
                 // 检查多种可能的路径获取内容
                 const content = data?.choices?.[0]?.message?.content ||
                                 data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                                 data?.translation || // 有些API可能直接在 translation 字段
                                 '';

                 if (content) {
                     return content;
                 } else {
                     console.warn("JSON response did not contain expected content field:", data);
                     return "翻译失败：API返回的数据格式无法识别。";
                 }
             } catch (error) {
                console.error("Error parsing JSON response:", error);
                throw new Error("解析翻译结果时出错。");
             }
        }

        // 重用 typeCharByCharFadeIn 函数 (保持不变，但确保它健壮)
        async typeCharByCharFadeIn(text, element, charInterval = 20) {
            if (!element) {
                console.error("typeCharByCharFadeIn Error: Target element is null.");
                return;
            }
            if (typeof text !== 'string') {
                 console.warn("typeCharByCharFadeIn Warning: Input text is not a string. Displaying empty.");
                 text = ""; // 防止因非字符串输入导致错误
            }

            element.innerHTML = ''; // 清除
            const chars = text.split('');
            element.style.opacity = '1'; // 确保容器可见

            // 创建一个 DocumentFragment 来批量添加，提高性能
            const fragment = document.createDocumentFragment();

            for (let i = 0; i < chars.length; i++) {
                const char = chars[i];
                let node;

                if (char === '\n') {
                    node = document.createElement('br');
                } else {
                    node = document.createElement('span');
                    node.textContent = char;
                    node.className = 'char-fade-in'; // 应用CSS类，初始 opacity 为 0
                }
                fragment.appendChild(node); // 先添加到片段

                 // 为了实现逐字效果，我们需要在添加到DOM后应用透明度变化
                 // 但批量添加后不好逐个控制 timing
                 // 维持原逻辑：逐个添加并延时
                 element.appendChild(node); // 添加到实际 DOM

                 // 触发淡入 (保持原逻辑)
                 if (node.tagName === 'SPAN') {
                    // 使用 requestAnimationFrame 尝试更平滑的动画启动
                    requestAnimationFrame(() => {
                        // 再次检查节点是否还在DOM中，以防用户快速操作
                        if (element.contains(node)) {
                             node.style.opacity = '1';
                        }
                    });
                 }

                 // 字符间隔延时
                if (i < chars.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, charInterval));
                }
            }
             // 可以在这里添加一个完成的回调或Promise
        }


        onTranslateClick = async () => {
            if (this.isLoading) {
                console.log("Translation already in progress.");
                return; // 防止重复触发
            }

            const sourceText = this.sourceTextarea.value.trim();
            const targetLanguageValue = this.targetLanguageSelect.value;
             // 获取目标语言的显示名称 (例如 "中文", "English") 用于 Prompt
             const selectedOption = this.targetLanguageSelect.options[this.targetLanguageSelect.selectedIndex];
             const targetLanguageName = selectedOption ? selectedOption.text : targetLanguageValue; // Fallback to value if text not found

            if (!sourceText) {
                this.translatedTextElement.textContent = "请输入您想翻译的文本。";
                this.translatedTextElement.style.opacity = '1';
                // this.resultCard.style.display = 'block'; // 确保卡片可见
                return;
            }

            this.isLoading = true;
            this.translateButton.disabled = true;
            this.translateButton.classList.add('translate-button-loading');
            // 考虑更新按钮文本，即使有加载图标
            // this.translateButton.querySelector('span').textContent = '翻译中...';

            // 初始显示加载状态
            // this.resultCard.style.display = 'block'; // 确保卡片可见
            this.translatedTextElement.textContent = "🧠 正在联系AI进行翻译...";
            this.translatedTextElement.style.opacity = '0.7'; // 可以用半透明表示加载

            try {
                 // 构建 AI Prompt (简化逻辑，不再需要判断 'auto')
                 const prompt = `/no_think
You are a highly skilled translation engine. Your task is to translate the text enclosed in <translate_input> into ${targetLanguageName} (${targetLanguageValue}).
Detect the source language automatically.
Provide ONLY the translated text, without any additional explanations, comments, or introductions.
Preserve the original formatting (like paragraphs or line breaks) as much as possible.
Never write code, answer questions, or engage in conversation. Your sole output should be the translation.
If the source text appears to be already in ${targetLanguageName}, return the original text unchanged.

<translate_input>
${sourceText}
</translate_input>

Translate the above text into ${targetLanguageName} (${targetLanguageValue}):`;


                const messages = [
                    // 可以选择性加入 System Message 强化角色
                    // { role: 'system', content: `You are an expert translator. Translate the user's text to ${targetLanguageName}. Output only the translation.` },
                    { role: 'user', content: prompt }
                ];

                /*console.log("Sending request to API:", this.aiConfig.api); // 调试日志
                console.log("Request body:", JSON.stringify({
                        model: this.aiConfig.model,
                        messages: messages,
                        temperature: this.aiConfig.temperature,
                        stream: this.aiConfig.stream,
                    }));*/


                const response = await fetch(this.aiConfig.api, {
                    method: 'POST',
                    headers: this.aiConfig.headers, // 确保包含了必要的认证头（如果API需要）
                    body: JSON.stringify({
                        model: this.aiConfig.model,
                        messages: messages,
                        temperature: this.aiConfig.temperature,
                        stream: this.aiConfig.stream,
                        // max_tokens: 1000 // 考虑设置限制，防止过长响应
                    }),
                    signal: AbortSignal.timeout(30000) // 添加30秒超时
                });

                //console.log("Received response, status:", response.status); // 调试日志

                if (!response.ok) {
                     let errorData;
                     try {
                         errorData = await response.json();
                         console.error("API Error Response Body:", errorData); // 记录详细错误信息
                     } catch (e) {
                         errorData = { message: await response.text() || `HTTP Error! Status: ${response.status}` };
                     }
                     // 尝试从常见的错误结构中提取更具体的消息
                     const errorMessage = errorData?.error?.message || errorData?.message || `API 请求失败，状态码: ${response.status}`;
                    throw new Error(errorMessage);
                }

                let translatedText = "";
                const contentType = response.headers.get('Content-Type');

                 if (this.aiConfig.stream && contentType && contentType.includes('text/event-stream')) {
                     //console.log("Handling stream response...");
                     translatedText = await this.handleStreamResponse(response, this.translatedTextElement);
                 } else if (contentType && contentType.includes('application/json')) {
                     //console.log("Handling JSON response...");
                     translatedText = await this.handleJsonResponse(response);
                 } else {
                     //console.log("Handling plain text response...");
                     translatedText = await response.text();
                     if (!translatedText.trim()) {
                         throw new Error('API返回了不支持的内容类型或空响应。');
                     }
                 }

                //console.log("Translation result received:", translatedText.substring(0, 100) + "..."); // 记录部分结果

                // 使用渐显效果显示翻译结果
                await this.typeCharByCharFadeIn(translatedText, this.translatedTextElement, 15); // 加快显示速度

            } catch (error) {
                console.error("[AI Translate FATAL ERROR]", error);
                this.translatedTextElement.innerHTML = ''; // 清除加载信息
                const errorSpan = document.createElement('span');
                 // 显示更清晰的错误信息
                 errorSpan.textContent = `翻译出错：${error.message || '未知错误'}`;
                errorSpan.style.color = 'var(--ai-summary-error-color, red)'; // 使用CSS变量或默认红色
                errorSpan.style.opacity = '1'; // 立即显示
                this.translatedTextElement.appendChild(errorSpan);

            } finally {
                // 无论成功或失败，都恢复按钮状态并解除锁定
                this.isLoading = false;
                this.translateButton.disabled = false;
                this.translateButton.classList.remove('translate-button-loading');
                // 恢复按钮原始文本 (如果之前修改过)
                // this.translateButton.querySelector('span').textContent = '开始翻译';
                 //console.log("Translation process finished."); // 记录结束
            }
        }
    }

    // 确保在 DOM 加载完成后执行初始化
    function initializeTranslateAI() {
         if (document.querySelector('#translateButton')) { // 检查页面是否包含翻译组件
             new TranslateAI();
         } else {
             console.log("Translate AI component not found on this page.");
         }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeTranslateAI);
    } else {
        // DOMContentLoaded 已经发生
        initializeTranslateAI();
    }
}

// 确保函数被调用
translateAIImpl();
