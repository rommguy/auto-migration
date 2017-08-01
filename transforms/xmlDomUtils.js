var xmlDom = require('xmldom');
var Parser = xmlDom.DOMParser;
var Serializer = xmlDom.XMLSerializer;
var _ = require('lodash');

var dummyWrapper = 'dummyWrapper';
var dummyOpenTag = '<' + dummyWrapper + '>';
var dummyCloseTag = '</' + dummyWrapper + '>';

function isNewLineTextNode(node) {
    return node && node.nodeType === 3 && _.contains(node.nodeValue, '\n');
}

function removeIndentation(node) {
    if (!isNewLineTextNode(node)) {
        return;
    }

    var textValue = node.nodeValue;
    textValue = textValue.substring(0, textValue.lastIndexOf('\n'));

    node.nodeValue = textValue;
    node.data = textValue;
}

function traverse(node, predicate, callback) {
    if (predicate(node)) {
        callback(node);
    }

    _.forEach(node.childNodes, function (childNode) {
        traverse(childNode, predicate, callback);
    });
}

function removeWrapping(str, prefix, suffix) {
    if (_.startsWith(str, prefix)) {
        str = str.substring(prefix.length);
    }
    if (_.endsWith(str, suffix)) {
        str = str.substring(0, str.length - suffix.length);
    }

    return str;
}

function removeNode(node) {
    var parent = node.parentNode;

    removeIndentation(node.previousSibling);
    parent.removeChild(node);
}

function parse(xml) {
    return new Parser().parseFromString(dummyOpenTag + xml + dummyCloseTag);
}

function serialize(xml) {
    var result = new Serializer().serializeToString(xml);
    result = removeWrapping(result, dummyOpenTag, dummyCloseTag);
    return result.replace(/ &amp;&amp; /g, ' && ');
}

function traverseAttributes(document, predicate, callback) {
    traverse(document, function () {
        return true;
    }, function (node) {
        _.forEach(node.attributes, function (attribute) {
            if (predicate(attribute)) {
                callback(attribute);
            }
        });
    });
}

module.exports = {
    parse: parse,
    removeWrapping: removeWrapping,
    serialize: serialize,
    traverse: traverse,
    traverseAttributes: traverseAttributes,
    removeNode: removeNode
};