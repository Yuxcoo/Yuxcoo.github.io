// gemini.js
function geminiAIImpl() {
  // console.log("geminiAIImpl function called");

  class GeminiAI {
    constructor() {
      this.initAI();
    }

    initVariables() {
      this.version = '1.1.x';
      this.unFinishFlag = 'data-code-input';
      this.lastUnFinishCodeReg = new RegExp(`<code\\s${this.unFinishFlag}="">(.*?)<\\/code>`);

      this.aiTriggerButtonSelector = '.ai-summary-trigger-button';
      this.postAIContainerSelector = '.post-gemini-ai';
      this.pandaButtonImagePath = 'https://e3f49eaa46b57.cdn.sohucs.com/2025/5/7/21/39/MTAwMTIyXzE3NDY2MjUxOTYzMDY=.png';
      this.pandaSummaryImagePath = 'https://e3f49eaa46b57.cdn.sohucs.com/2025/5/7/23/22/MTAwMTIyXzE3NDY2MzEzNzY1MTg=.png';
      
      this.aiConfig = {
        api: 'https://gemini-proxy.icjlu.eu.org/v1/chat/completions',
        tagConfig: { 'content': '.post-content', 'title': '.post-title', 'toc': '.toc-content' },
        maxToken: 2000,
        model: 'gemini-2.0-flash',
        modelDisplayName: 'Gemini 2.0',
        temperature: 0.7,
        prompt: "You are a highly skilled AI trained in language comprehension and summarization. I would like you to read the text delimited by triple quotes and summarize it into a concise abstract paragraph. Aim to retain the most important points, providing a coherent and readable summary that could help a person understand the main points of the discussion without needing to read the entire text. Please avoid unnecessary details or tangential points. Only give me the output and nothing else. Do not wrap responses in quotes. The response should be less than 150 words. Respond in the Chinese language.",
        headers: { 'Content-Type': 'application/json' },
        stream: false, // 或 true，根据你的 API 偏好
      };
      this.postAIContainer = document.querySelector(this.postAIContainerSelector);
      this.postTile = document.querySelector(this.aiConfig.tagConfig.title)?.textContent;
    }

    initAI() {
      this.initVariables();
      if (!this.postAIContainer) return;
      queueMicrotask(() => {
        this.initBrandInfo();
        this.initAiTriggerButton();
      });
    }

    initBrandInfo() {
      if (this.initBrandBefore || window.initAIBrandBefore) return;
      const information = [`╔═══════════════════╗\n║  STAY HUNGRY,     ║\n║                   ║\n║  STAY FOOLISH.    ║\n╚═══════════════════╝`];
      console.log(`%c WELCOME TO VISIT MY BLOG.`, 'color:white; background-color:#4f90d9');
      console.log(`%cCURRENT VERSION: %cv${this.version}`, '', 'color:white; background-color:#4fd953');
      console.log(`%c${information[0]}`, 'color:#ff69b4;');
      this.initBrandBefore = window.initAIBrandBefore = true;
    }

    initAiTriggerButton() {
      if (!this.postAIContainer) return;
      const triggerButton = this.postAIContainer.querySelector(this.aiTriggerButtonSelector);
      if (!triggerButton) return;
      const pandaBtnImg = triggerButton.querySelector('.panda-button-img');
      if (pandaBtnImg && this.pandaButtonImagePath) pandaBtnImg.src = this.pandaButtonImagePath;
      triggerButton.addEventListener('click', this.onAIClick.bind(this));
    }
    
    // parseCodeString 可以简化或移除，如果 AI 输出是纯文本
    // 目前保留用于潜在的复杂情况，但不用于此效果。
    parseCodeString(content) {
        let escapedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        return escapedContent.replace(/\n/g, '<br>');
    }

    async handleStreamResponse(response) {
      const reader = response.body.getReader();
      let fullText = "";
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const textChunk = decoder.decode(value, { stream: true });
        const strList = textChunk.split('\n').filter(Boolean);
        const chunkContent = strList.reduce((acc, currentValue) => {
          if (currentValue.includes('DONE') || !currentValue.includes('data:')) return acc;
          try {
                const data = JSON.parse(currentValue.substring(6));
                const nextStr = data?.choices[0].delta.content;
                return nextStr ? `${acc}${nextStr}` : acc;
          } catch (e) { console.warn("Error parsing stream data:", e, "Data:", currentValue); return acc; }
        }, '');
        if (chunkContent) fullText += chunkContent;
      }
      const remaining = decoder.decode();
      if (remaining) fullText += remaining;
      return fullText;
    }

    async handleJsonResponse(data) {
      const content = data?.choices[0].message.content;
      if (content) {
        return content;
      } else {
        console.error("JSON response contains no content:", data);
        return "Error: Could not retrieve summary.";
      }
    }

    initAiSummaryCard() {
      // 如果重新生成，移除已存在的卡片结构
      const existingPandaContainer = this.postAIContainer.querySelector('.ai-summary-decorative-panda-container');
      if (existingPandaContainer) existingPandaContainer.remove();
      const existingCard = this.postAIContainer.querySelector('.ai-summary-card');
      if (existingCard) existingCard.remove();

    // 1. 装饰性熊猫的HTML（放置在卡片上方）
      const decorativePandaHTML = `
        <div class="ai-summary-decorative-panda-container">
          <img src="${this.pandaSummaryImagePath}" alt="" class="ai-summary-decorative-panda">
        </div>
      `;

      const summaryCardHTML = `
        <div class="ai-summary-card">
          <div class="ai-summary-header">
            <div class="ai-summary-header-title">
              <span>文章摘要</span>
            </div>
            <span class="ai-summary-model-name">${this.aiConfig.modelDisplayName}</span>
          </div>
          <div class="post-gemini-ai-result-content">
            <p class="post-gemini-ai-result"></p> 
          </div>
          <div class="ai-summary-footer">
            AI榨汁机上线！挤干精华，只留文章“糟粕”，量少且管饱～
          </div>
        </div>
      `;
      // 将新的HTML元素插入到主AI容器中
      // this.postAIContainer.innerHTML = decorativePandaHTML + summaryCardHTML; // 这将清除其他可能的子元素
      // 如果postAIContainer可能有其他固定元素（例如按钮），则更安全的方法
      // 假设按钮是同级元素，我们想在它之后或特定位置添加这些内容。
      // 为简单起见，如果postAIContainer只包含触发按钮和卡片：
      const triggerButton = this.postAIContainer.querySelector(this.aiTriggerButtonSelector);

      // 在函数开始时已经清除了之前的摘要元素
      // 插入熊猫和卡片。如果按钮存在，则在按钮后插入。
      // 否则，追加到容器。
      const combinedHTML = decorativePandaHTML + summaryCardHTML;
      if (triggerButton && triggerButton.nextSibling) {
          triggerButton.insertAdjacentHTML('afterend', combinedHTML);
      } else if (triggerButton) {
          // 如果触发按钮是最后一个子元素
            this.postAIContainer.insertAdjacentHTML('beforeend', combinedHTML);
      } else {
          // 如果没有触发按钮（例如它被隐藏并移除了），则追加到容器
            this.postAIContainer.innerHTML = combinedHTML; // 或者如果有其他内容，则追加
      }
    }

    escapeHtml(str) {
      if (!str) return '';
      return str.replace(/\n/g, ' ').replace(/[ ]+/g, ' ').replace(/<pre>[\s\S]*?<\/pre>/g, '').replace(/<code[^>]*>[\s\S]*?<\/code>/g, '').replace(/<[^>]+>/g, '');
    }

    async typeCharByCharFadeIn(text, element, charInterval = 30) { // charInterval 以毫秒为单位
        element.innerHTML = ''; // 清除“加载中...”或之前的内容
        const chars = text.split('');
    
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
    
            if (char === '\n') {
                element.appendChild(document.createElement('br'));
            } else {
                const span = document.createElement('span');
                span.textContent = char; // textContent 安全处理 HTML 实体
                span.className = 'char-fade-in'; // 指定用于 CSS 过渡的类
                element.appendChild(span);
    
                // 触发淡入效果
                // 使用极短的 timeout 或 rAF 确保浏览器注册初始 opacity:0 后再将其设为 1
                setTimeout(() => {
                    span.style.opacity = '1';
                }, 10); // 微小延迟以确保过渡触发
            }
    
            if (i < chars.length - 1) { // 最后一个字符后不延迟
                await new Promise(resolve => setTimeout(resolve, charInterval));
            }
        }
    }

    onAIClick = async () => {
      const triggerButton = this.postAIContainer.querySelector(this.aiTriggerButtonSelector);
      if (!triggerButton || triggerButton.classList.contains('hidden')) return;
      
      triggerButton.classList.add('hidden');
      this.initAiSummaryCard(); 

      const postAIResultEl = this.postAIContainer.querySelector('.post-gemini-ai-result');
      if (!postAIResultEl) {
        triggerButton.classList.remove('hidden');
        return;
      }

      postAIResultEl.textContent = "正在生成摘要，请稍候...";
      //console.log('[DEBUG AI] 加载文本已设置。');

      try {
        const contentElem = document.querySelector(this.aiConfig.tagConfig.content);
        if (!contentElem) throw new Error("未找到文章内容元素。");
        let input = contentElem.innerText;
        const postToc = document.querySelector(this.aiConfig.tagConfig.toc);
        let inputContent = this.escapeHtml(input).substring(0, this.aiConfig.maxToken);
        let toAI = `文章标题：${this.postTile || 'N/A'}；文章目录：${postToc?.textContent || 'N/A'}；具体内容："""${inputContent}"""`;
      
        const res = await fetch(this.aiConfig.api, {
          method: 'POST',
          headers: this.aiConfig.headers,
          body: JSON.stringify({
            model: this.aiConfig.model,
            messages: [{ role: 'system', content: this.aiConfig.prompt }, { role: 'user', content: toAI }],
            temperature: this.aiConfig.temperature,
            stream: this.aiConfig.stream,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: `HTTP 错误! 状态: ${res.status}` }));
          throw new Error(errorData.message || `HTTP 错误! 状态: ${res.status}`);
        }

        let summaryText = "";
        const contentType = res.headers.get('Content-Type');

        if (contentType && contentType.includes('text/event-stream') && (this.aiConfig.stream === true || this.aiConfig.stream === undefined)) {
          summaryText = await this.handleStreamResponse(res);
        } else if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          summaryText = await this.handleJsonResponse(data);
        } else {
          summaryText = await res.text();
          if (!summaryText.trim()) throw new Error('API返回内容为空或不支持的内容类型。');
        }
        
        //console.log(`[DEBUG AI] 已收到摘要文本（前50字符）: "${String(summaryText).substring(0,50)}"`);

        // 调用新函数，逐个字符淡入显示文本
        const charDisplayInterval = 30; // 每个字符显示之间的毫秒数。可调整速度。
        await this.typeCharByCharFadeIn(summaryText, postAIResultEl, charDisplayInterval);
        
        //console.log('[DEBUG AI] 逐字符淡入完成。');

      } catch (error) {
        console.error("[ERROR AI] AI 摘要错误:", error.message);
        if (postAIResultEl) {
          // 显示错误信息，不逐字符显示
          postAIResultEl.innerHTML = ''; // 清除加载信息
          const errorSpan = document.createElement('span');
          errorSpan.textContent = `抱歉，生成摘要时遇到问题：${error.message}`;
          errorSpan.style.opacity = '1'; // 立即显示错误信息
          postAIResultEl.appendChild(errorSpan);
        }
        // const summaryCard = this.postAIContainer.querySelector('.ai-summary-card');
        // if (summaryCard) summaryCard.remove(); // 可考虑保留卡片以显示错误
        if(triggerButton) triggerButton.classList.remove('hidden');
      } finally {
        // 此版本中不再需要隐藏光标
        //console.log('[DEBUG AI] onAIClick: 逐字符淡入效果已完成。');
      }
    }
  }

  new GeminiAI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    geminiAIImpl();
  });
} else {
  geminiAIImpl();
}
