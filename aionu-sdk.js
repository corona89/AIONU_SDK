/**
 * AIONU JavaScript SDK
 * Supports IE11, Chrome, Edge
 * Features: Robust XHR Streaming with Buffer, Markdown Rendering, Parameters & Suggestions
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
                console.error('AIONU SDK Request Error:', status, error, xhr.responseText);
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
     * Robust Streaming with Buffer
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
        var lineBuffer = ''; // <--- Essential for chunked data
        var fullAnswer = '';

        xhr.open('POST', url, true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + this.apiKey);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onreadystatechange = function() {
            // Handle HTTP errors (4xx, 5xx)
            if (xhr.readyState >= 2 && xhr.status >= 400) {
                if (params.onError) {
                    var errorData;
                    try { errorData = JSON.parse(xhr.responseText); } catch(e) { errorData = { message: xhr.statusText }; }
                    params.onError({ status: xhr.status, message: errorData.message || xhr.responseText });
                }
                xhr.abort();
                return;
            }

            if (xhr.readyState === 3 || xhr.readyState === 4) {
                var newData = xhr.responseText.substring(seenBytes);
                seenBytes = xhr.responseText.length;
                
                lineBuffer += newData;
                var lines = lineBuffer.split('\n');
                lineBuffer = lines.pop(); // Keep partial line in buffer

                $.each(lines, function(i, line) {
                    line = $.trim(line);
                    if (!line || line.indexOf('data: ') !== 0) return;
                    
                    try {
                        var data = JSON.parse(line.substring(6));
                        
                        if (data.event === 'message' || data.event === 'agent_message') {
                            var delta = data.answer || '';
                            if (delta) {
                                fullAnswer += delta;
                                if (params.onMessage) params.onMessage(delta, fullAnswer, data);
                            }
                        } 
                        
                        if (data.event === 'message_end') {
                            if (data.conversation_id) self.conversationId = data.conversation_id;
                            if (params.onFinished) params.onFinished(fullAnswer, data);
                        }

                        if (data.event === 'error') {
                            if (params.onError) params.onError(data);
                        }
                    } catch (e) {
                        console.warn('SDK: Failed to parse line', line, e);
                    }
                });
            }

            if (xhr.readyState === 4 && xhr.status < 400 && xhr.status !== 0) {
                // If the connection closed but some data was left in buffer
                if (lineBuffer && lineBuffer.indexOf('data: ') === 0) {
                    try {
                        var data = JSON.parse(lineBuffer.substring(6));
                        if (data.event === 'message_end') {
                           if (params.onFinished) params.onFinished(fullAnswer, data);
                        }
                    } catch(e) {}
                }
            }
        };

        xhr.onerror = function(err) {
            console.error('SDK: Network Error', err);
            if (params.onError) params.onError({ message: '네트워크 연결 오류 혹은 CORS 차단' });
        };

        xhr.send(JSON.stringify(body));
        return xhr;
    };

    window.AionUSDK = AionUSDK;

})(window, jQuery);
