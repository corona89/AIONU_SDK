/**
 * AIONU JavaScript SDK
 * Supports IE11, Chrome, Edge
 * Features: Robust XHR Manual Streaming, Markdown Rendering, Parameters & Suggestions
 * (Fixed for Streaming Parse Robustness)
 */
(function(window, $) {
    'use strict';

    function AionUSDK(config) {
        this.endpoint = (config.endpoint || 'https://api.abclab.ktds.com/v1').replace(/\/$/, '');
        this.apiKey = config.apiKey;
        this.conversationId = config.conversationId || null;
    }

    /**
     * Common Ajax Wrapper
     */
    AionUSDK.prototype._request = function(method, path, data, successCallback, errorCallback) {
        $.ajax({
            url: this.endpoint + path,
            type: method,
            headers: {
                'Authorization': 'Bearer ' + this.apiKey,
                'Content-Type': 'application/json'
            },
            data: data ? JSON.stringify(data) : null,
            success: successCallback,
            error: function(xhr, status, error) {
                if (errorCallback) errorCallback(xhr, status, error);
            }
        });
    };

    AionUSDK.prototype.getParameters = function(successCallback, errorCallback) {
        this._request('GET', '/parameters', null, successCallback, errorCallback);
    };

    AionUSDK.prototype.getSuggested = function(messageId, successCallback, errorCallback) {
        this._request('GET', '/messages/' + messageId + '/suggested-questions', null, successCallback, errorCallback);
    };

    AionUSDK.prototype.refresh = function() {
        this.conversationId = null;
        return this.conversationId;
    };

    /**
     * Enhanced Robust Streaming
     */
    AionUSDK.prototype.chatStream = function(params) {
        var self = this;
        var url = this.endpoint + '/chat-messages';
        
        var body = {
            query: params.query,
            inputs: params.inputs || {},
            user: params.user || 'default_user',
            conversation_id: this.conversationId,
            response_mode: 'streaming'
        };

        var xhr = new XMLHttpRequest();
        var seenBytes = 0;
        var fullAnswer = '';
        var lineBuffer = '';

        xhr.open('POST', url, true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + this.apiKey);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onreadystatechange = function() {
            // Early Error Check
            if (xhr.readyState >= 2 && xhr.status >= 400) {
                var errJson;
                try { errJson = JSON.parse(xhr.responseText); } catch(e) { errJson = { message: xhr.statusText || '서버 응답 오류' }; }
                if (params.onError) params.onError(errJson);
                xhr.abort();
                return;
            }

            if (xhr.readyState === 3 || xhr.readyState === 4) {
                var responseText = xhr.responseText;
                var newData = responseText.substring(seenBytes);
                seenBytes = responseText.length;
                
                lineBuffer += newData;
                var lines = lineBuffer.split('\n');
                lineBuffer = lines.pop(); // Last incomplete line

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].replace(/^\s+|\s+$/g, '');
                    if (!line) continue;
                    
                    if (line.indexOf('data: ') === 0) {
                        var jsonStr = line.substring(6);
                        try {
                            var data = JSON.parse(jsonStr);
                            
                            // Streaming Error
                            if (data.event === 'error') {
                                if (params.onError) params.onError(data);
                                xhr.abort();
                                break;
                            }

                            // Message Delta
                            if (data.event === 'message' || data.event === 'agent_message') {
                                var delta = data.answer || '';
                                if (delta) {
                                    fullAnswer += delta;
                                    if (params.onMessage) params.onMessage(delta, fullAnswer, data);
                                }
                            } 
                            
                            // End
                            if (data.event === 'message_end') {
                                if (data.conversation_id) self.conversationId = data.conversation_id;
                                if (params.onFinished) params.onFinished(fullAnswer, data);
                            }
                        } catch (e) {
                            // Partial JSON, skip or wait next chunk
                        }
                    }
                }
            }
        };

        xhr.onerror = function() {
            if (params.onError) params.onError({ message: '네트워크 연결 오류 혹은 CORS 차단입니다. (로컬 서버 권장)' });
        };

        xhr.send(JSON.stringify(body));
        return xhr;
    };

    window.AionUSDK = AionUSDK;

})(window, jQuery);
