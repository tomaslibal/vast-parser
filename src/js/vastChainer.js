define(['jquery', './vast-parser', 'q', './vastErrorCodes', './vastError'],
    function($, vastParser, Q, vastErrorCodes, VastError) {

        var AJAX_TIMEOUT = 10000,
            vastRequestCounter = 0,
            dispatcher = $({});

        function getVastChain(vastConfig) {
            return getVast(vastConfig);
        }

        function addEventListener(eventName, handler) {
            dispatcher.on(eventName, handler);
        }

        function getDomainFromURL(url) {
            var a = window.document.createElement('a');
            a.href = url;
            return a.hostname;
        }

        function getVast(vastConfig) {
            var url = vastConfig.url,
                deferred = Q.defer(),
                currentRequestNumber = vastRequestCounter++,
                requestStartEvent,
                settings,
                vastDomain = getDomainFromURL(url);

            if (vastConfig.extraParams) {
                vastConfig.extraParams.forEach(function(extraParams) {
                    var paramsAreForThisVASTDomain = extraParams.domains.indexOf(vastDomain) !== -1;

                    if (paramsAreForThisVASTDomain) {
                        if (vastConfig.url.indexOf('?') !== -1) {
                            url += '&' + extraParams.params;
                        } else {
                            url += '?' + extraParams.params;
                        }
                    }
                });
            }

            settings = {
                url: url,
                headers: vastConfig.headers || {},
                dataType: 'xml'
            };

            if ((vastConfig.corsCookieDomains instanceof Array) && vastConfig.corsCookieDomains.indexOf(getDomainFromURL(url)) !== -1) {
                settings.xhrFields = {
                    withCredentials: true
                };
            }

            settings.timeout = AJAX_TIMEOUT;

            settings.success = function(data) {
                var vastTag,
                    childTagUri,
                    nextRequestConfig,
                    vastTags,
                    requestEndEvent;

                requestEndEvent = $.Event('requestEnd', {
                    requestNumber: currentRequestNumber,
                    uri: url
                });
                dispatcher.trigger(requestEndEvent);

                if (!data) {
                    deferred.reject(new VastError(vastErrorCodes.XML_PARSE_ERROR.code));
                    return;
                }

                vastTag = vastParser.parse(data);

                if (vastTag.VAST.Error) {
                    deferred.reject(new VastError(vastErrorCodes.NO_ADS.code, 'VAST request returned no ads and contains error tag'));
                    return;
                }

                if (!vastTag.VAST.Ad) {
                    deferred.reject(new VastError(vastErrorCodes.NO_ADS.code, 'VAST request returned no ads'));
                    return;
                }

                if (vastTag.VAST && vastTag.VAST.Ad && vastTag.VAST.Ad.InLine) {
                    vastTags = {
                        inline: vastTag
                    };
                    deferred.resolve(vastTags);
                    return;
                }

                vastTags = {
                    wrappers: [vastTag]
                };

                childTagUri = vastTag.VAST && vastTag.VAST.Ad && vastTag.VAST.Ad.Wrapper && vastTag.VAST.Ad.Wrapper.VASTAdTagURI.nodeValue;
                nextRequestConfig = {
                    url: childTagUri,
                    extraParams: vastConfig.extraParams,
                    corsCookieDomains: vastConfig.corsCookieDomains
                };

                getVast(nextRequestConfig)
                    .then(function(childTag) {

                        vastTags.inline = childTag.inline;

                        if (childTag.wrappers) {
                            vastTags.wrappers = vastTags.wrappers.concat(childTag.wrappers);
                        }

                        deferred.resolve(vastTags);
                    })
                    .fail(function(errorObj) {
                        deferred.reject(errorObj);
                    })
                    .done();
            };

            settings.error = function(jqXHR, textStatus) {
                var code,
                    requestEndEvent,
                    statusText;

                if (jqXHR.status === 200 && !jqXHR.responseXML) {
                    code = vastErrorCodes.XML_PARSE_ERROR.code;
                    statusText = vastErrorCodes.XML_PARSE_ERROR.message;
                } else {
                    code = vastErrorCodes.WRAPPER_URI_TIMEOUT.code;
                    statusText = jqXHR.statusText;
                }

                requestEndEvent = $.Event('requestEnd', {
                    requestNumber: currentRequestNumber,
                    uri: url,
                    error: {
                        status: jqXHR.status,
                        statusText: statusText
                    }
                });
                dispatcher.trigger(requestEndEvent);
                deferred.reject(new VastError(code, 'VAST Request Failed (' + textStatus + ' ' + jqXHR.status + ')'));
            };

            requestStartEvent = $.Event('requestStart', {
                requestNumber: currentRequestNumber,
                uri: url
            });
            dispatcher.trigger(requestStartEvent);

            $.ajax(settings);

            return deferred.promise;
        }

        return {
            getVastChain: getVastChain,
            addEventListener: addEventListener,
            on: addEventListener
        };

    });