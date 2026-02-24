/**
 * AIONU JavaScript SDK
 * Supports IE11, Chrome, Edge
 * Features: Robust XHR Manual Streaming, Markdown Rendering, Parameters & Suggestions
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
     * Advanced Robust XHR Streaming
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
        var isFinished = false;

        xhr.open('POST', url, true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + this.apiKey);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onreadystatechange = function() {
            // Check status for error handling
            if (xhr.readyState >= 2 && xhr.status >= 400) {
                var errDetail = xhr.responseText;
                try {
                    var parsed = JSON.parse(xhr.responseText);
                    errDetail = parsed.message || parsed.code || xhr.responseText;
                } catch(e) {}
                
                if (params.onError) {
                    params.onError({ status: xhr.status, message: errDetail });
                }
                xhr.onreadystatechange = null; // Prevent duplicate calls
                xhr.abort();
                return;
            }

            if (xhr.readyState === 3 || xhr.readyState === 4) {
                var responseText = xhr.responseText;
                
                var newData = responseText.substring(seenBytes);
                seenBytes = responseText.length;
                
                lineBuffer += newData;
                // Fix: Handle mixed newlines (\r\n, \r, \n) for robust chunk processing
                var lines = lineBuffer.split(/\r\n|\r|\n/);
                
                // If stream is done, process remaining buffer even if no newline
                if (xhr.readyState === 4) {
                    // Process all lines including potentially incomplete last line
                } else {
                    lineBuffer = lines.pop(); // Keep partial line
                }

                for (var i = 0; i < lines.length; i++) {
                    var line = $.trim(lines[i]);
                    // Fix: Allow 'data:' without space and handle various formats
                    if (!line || line.indexOf('data:') !== 0) continue;
                    
                    var jsonStr = line.substring(5);
                    if (jsonStr.length > 0 && jsonStr.charAt(0) === ' ') {
                        jsonStr = jsonStr.substring(1);
                    }

                    try {
                        var data = JSON.parse(jsonStr);
                        
                        if (data.event === 'error') {
                            if (params.onError) params.onError(data);
                            xhr.abort();
                            return;
                        }

                        if (data.event === 'message' || data.event === 'agent_message') {
                            var delta = data.answer || '';
                            fullAnswer += delta;
                            if (params.onMessage) params.onMessage(delta, fullAnswer, data);
                        } 
                        
                        if (data.event === 'message_end') {
                            isFinished = true;
                            if (data.conversation_id) self.conversationId = data.conversation_id;
                            if (params.onFinished) params.onFinished(fullAnswer, data);
                        }
                    } catch (e) {
                        // Incomplete JSON chunk, skip
                    }
                }
                
                if (xhr.readyState === 4 && !isFinished && xhr.status === 200) {
                     if (params.onError) params.onError({ message: 'Stream ended unexpectedly (incomplete response)' });
                }
            }
        };

        xhr.onerror = function() {
            if (params.onError) params.onError({ message: '네트워크 연결 실패 (CORS 혹은 오프라인)' });
        };

        xhr.send(JSON.stringify(body));
        return xhr;
    };

    window.AionUSDK = AionUSDK;

})(window, jQuery);
