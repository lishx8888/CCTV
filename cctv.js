// ==UserScript==
// @name         央视网&央视频 一键复制m3u8下载链接（国内优化版）
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  简洁高效的央视视频下载工具，国内直连稳定
// @author       Grok
// @match        *://tv.cctv.com/*
// @match        *://news.cctv.com/*
// @match        *://*.yangshipin.cn/*
// @match        *://*.cctv.com/*
// @match        *://*.cntv.cn/*
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // 从页面提取PID
    function extractPid() {
        console.log('开始提取PID');
        
        // 直接从URL获取
        let match = location.href.match(/[?&]pid[=:]?([a-f0-9]{32})/i);
        if (match) {
            console.log('从URL提取到PID:', match[1].toLowerCase());
            return match[1].toLowerCase();
        }

        // 尝试其他URL模式
        match = location.href.match(/VIDE([a-f0-9]{32})/i);
        if (match) {
            console.log('从URL模式提取到PID:', match[1].toLowerCase());
            return match[1].toLowerCase();
        }

        // 从脚本标签中提取
        const scripts = document.querySelectorAll('script');
        for (let s of scripts) {
            let m = s.textContent.match(/["']([a-f0-9]{32})["']/);
            if (m) {
                console.log('从脚本提取到PID:', m[1].toLowerCase());
                return m[1].toLowerCase();
            }
        }

        console.log('未能提取到PID');
        return null;
    }

    // 获取真实的hls_url
    function fetchRealHlsUrl(pid, callback) {
        console.log('开始获取视频链接');
        
        // 首先尝试从API获取
        const apiUrl = `https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=${pid}`;
        console.log('API请求URL:', apiUrl);
        
        try {
            GM_xmlhttpRequest({
                method: 'GET',
                url: apiUrl,
                onload: function(response) {
                    try {
                        console.log('API响应状态:', response.status);
                        const data = JSON.parse(response.responseText);
                        console.log('API返回数据:', data);
                        
                        // 如果API直接返回hls_url，使用它
                        if (data.hls_url) {
                            const finalUrl = data.hls_url;
                            console.log('API返回的hls_url:', finalUrl);
                            callback({ success: true, url: finalUrl });
                            return;
                        }
                        
                        // 如果没有直接的hls_url，尝试构建标准URL
                        buildStandardUrl(pid, callback);
                    } catch (e) {
                        console.error('解析API响应时出错:', e);
                        buildStandardUrl(pid, callback);
                    }
                },
                onerror: function(error) {
                    console.error('API请求失败:', error);
                    buildStandardUrl(pid, callback);
                }
            });
        } catch (e) {
            console.error('API请求异常:', e);
            buildStandardUrl(pid, callback);
        }
    }
    
    // 构建标准格式的URL
    function buildStandardUrl(pid, callback) {
        console.log('构建标准URL');
        
        // 尝试多个可能的CDN域名和路径格式
        const urlTemplates = [
            // 腾讯云CDN格式
            `https://newcntv.qcloudcdn.com/asp/hls/450/0303000a/3/default/${pid}/450.m3u8`,
            `https://newcntv.qcloudcdn.com/asp/hls/main/0303000a/3/default/${pid}/main.m3u8`,
            
            // 其他CDN格式
            `https://cntv.qcloudcdn.com/asp/hls/450/0303000a/3/default/${pid}/450.m3u8`,
            `https://hls.cntv.lxdns.com/asp/hls/450/0303000a/3/default/${pid}/450.m3u8`,
            `https://dhlswswx01.v.cntv.cn/asp/hls/450/0303000a/3/default/${pid}/450.m3u8`
        ];
        
        // 测试URL是否可访问
        testUrl(urlTemplates[0], function(isAccessible) {
            if (isAccessible) {
                callback({ success: true, url: urlTemplates[0] });
            } else {
                // 如果第一个URL不可访问，返回第一个URL作为备选
                console.log('URL不可访问，返回默认URL');
                callback({ 
                    success: true, 
                    url: urlTemplates[0],
                    warning: '无法验证URL有效性，返回默认格式链接' 
                });
            }
        });
    }
    
    // 测试URL是否可访问
    function testUrl(url, callback) {
        try {
            GM_xmlhttpRequest({
                method: 'HEAD',
                url: url,
                timeout: 2000,
                onload: function(response) {
                    const isAccessible = response.status >= 200 && response.status < 400;
                    console.log(`URL测试结果: ${url} - 状态码: ${response.status}, 可访问: ${isAccessible}`);
                    callback(isAccessible);
                },
                onerror: function() {
                    console.log(`URL测试失败: ${url}`);
                    callback(false);
                },
                ontimeout: function() {
                    console.log(`URL测试超时: ${url}`);
                    callback(false);
                }
            });
        } catch (e) {
            console.error(`测试URL时发生异常: ${e.message}`);
            callback(false);
        }
    }
    
    // 显示通知
    function showNotification(message, isError = false) {
        console.log(message);
        
        // 尝试使用GM_notification
        if (typeof GM_notification !== 'undefined') {
            try {
                GM_notification({
                    title: isError ? '央视下载工具 - 错误' : '央视下载工具',
                    text: message,
                    timeout: 3000
                });
                return;
            } catch (e) {
                console.error('GM_notification失败:', e);
            }
        }
        
        // 如果浏览器支持通知API
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                new Notification(isError ? '央视下载工具 - 错误' : '央视下载工具', {
                    body: message
                });
                return;
            } catch (e) {
                console.error('浏览器通知失败:', e);
            }
        }
        
        // 降级到alert
        alert(message);
    }
    
    // 创建下载按钮
    function createButton() {
        // 检查是否已经存在按钮，避免重复创建
        if (document.getElementById('cctv-download-btn-container')) {
            console.log('按钮已存在，跳过创建');
            return;
        }
        
        console.log('创建下载按钮');
        
        // 创建按钮容器
        const container = document.createElement('div');
        container.id = 'cctv-download-btn-container';
        container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            background: #fff;
            padding: 10px;
            border-radius: 6px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        
        // 创建标题
        const title = document.createElement('div');
        title.textContent = '央视下载工具';
        title.style.cssText = 'font-size: 14px; font-weight: bold; color: #333; text-align: center;';
        container.appendChild(title);
        
        // 创建下载按钮
        const button = document.createElement('button');
        button.id = 'cctv-download-btn';
        button.textContent = '获取下载链接';
        button.style.cssText = `
            padding: 8px 16px;
            background: #009fe8;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        
        button.addEventListener('mouseover', function() {
            this.style.background = '#0078b6';
        });
        
        button.addEventListener('mouseout', function() {
            this.style.background = '#009fe8';
        });
        
        // 按钮点击事件
        button.addEventListener('click', function() {
            const pid = extractPid();
            
            if (!pid) {
                showNotification('无法提取视频ID，请刷新页面重试', true);
                return;
            }
            
            console.log(`尝试获取PID: ${pid} 的下载链接`);
            button.disabled = true;
            button.textContent = '获取中...';
            
            // 获取下载链接
            fetchRealHlsUrl(pid, function(result) {
                button.disabled = false;
                button.textContent = '获取下载链接';
                
                if (result.success) {
                    const downloadUrl = result.url;
                    console.log('成功获取下载链接:', downloadUrl);
                    
                    // 显示警告（如果有）
                    if (result.warning) {
                        console.log('警告:', result.warning);
                        showNotification(result.warning, true);
                    }
                    
                    // 复制链接到剪贴板
                    try {
                        GM_setClipboard(downloadUrl);
                        if (!result.warning) {
                            showNotification('下载链接已复制到剪贴板');
                        }
                        
                        // 显示链接信息
                        const urlInfo = document.createElement('div');
                        urlInfo.style.cssText = 'font-size: 12px; color: #666; word-break: break-all; margin-top: 8px;';
                        urlInfo.textContent = downloadUrl;
                        
                        // 移除旧的信息显示
                        const oldInfo = container.querySelector('#cctv-url-info');
                        if (oldInfo) {
                            container.removeChild(oldInfo);
                        }
                        
                        urlInfo.id = 'cctv-url-info';
                        container.appendChild(urlInfo);
                    } catch (e) {
                        console.error('复制到剪贴板失败:', e);
                        showNotification('复制到剪贴板失败，请手动复制链接', true);
                    }
                } else {
                    showNotification('获取链接失败，请刷新页面重试', true);
                }
            });
        });
        
        container.appendChild(button);
        document.body.appendChild(container);
    }
    
    // 初始化函数
    function init() {
        console.log('央视下载工具初始化');
        
        // 立即尝试创建按钮
        createButton();
        
        // 注册菜单命令
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('重新获取下载按钮', function() {
                console.log('用户点击了重新获取下载按钮菜单');
                const oldContainer = document.getElementById('cctv-download-btn-container');
                if (oldContainer) {
                    document.body.removeChild(oldContainer);
                }
                createButton();
            });
        }
        
        // 设置定期检查，确保按钮存在
        setInterval(createButton, 5000);
    }
    
    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();