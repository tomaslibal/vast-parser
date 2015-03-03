define(['../../../node_modules/validator/validator', '../util/objectUtil', './vastLinearCreative'], function(validator, objectUtil, VastLinearCreative) {

    function VastResponse(vastChain) {
        this.wrappers = [];
        this.inline = undefined;
        this._raw = [];

        if (vastChain) {
            this.wrappers = vastChain.wrappers;
            this.inline = vastChain.inline;
        }

        this._vastChain = vastChain;
    }

    function isValidURL(url) {
        return validator.isURL(url, { allow_protocol_relative_urls: true });
    }

    VastResponse.prototype.getImpressions = function() {
        var inlineImps = objectUtil.getArrayFromObjectPath(this.inline, 'VAST.Ad.InLine.Impression.nodeValue'),
            wrapperImps = objectUtil.getArrayFromObjectPath(this.wrappers, 'VAST.Ad.Wrapper.Impression.nodeValue');

        return inlineImps.concat(wrapperImps).filter(isValidURL);
    };

    VastResponse.prototype.getAdTitle = function() {
        return this.inline.VAST.Ad.InLine.AdTitle.nodeValue;
    };

    VastResponse.prototype.getLinearCreative = function() {
        if (!this.linearCreative) {
            this.linearCreative = new VastLinearCreative.VastLinearCreative(this);
        }
        return this.linearCreative;
    };

    VastResponse.prototype.getRawResponses = function() {
        return this._raw;
    };

    VastResponse.prototype.addRawResponse = function(data) {
        this._raw.push(data);
    };

    return VastResponse;

});
