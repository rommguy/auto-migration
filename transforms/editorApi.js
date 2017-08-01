const _ = require('lodash');
const fs = require('fs');

const xmlDomUtils = require('./xmlDomUtils');

const wrapWithFunction = x => `function yonti(){${x};}`;

const connectTheComponent = wrapWithFunction(`
var ConnectedComponent = higherOrderComponents.connectEditorAPI(mapEditorApiToProps)(Component);

            ConnectedComponent.pure = Component;

            return ConnectedComponent`);


export default function transformer(file, api) {
    const j = api.jscodeshift;


    const replacements = function () {
        const allReplacements = [];

        function getArguments(args) {
            return _.map(args, arg => {
                if (arg === 'this.props.selectedComponent') {
                    return j.memberExpression(j.identifier('props'), j.identifier('selectedComponent'))
                }
                if (arg === 'this.props.selectedComponents') {
                    return j.memberExpression(j.identifier('props'), j.identifier('selectedComponents'))
                }
                if (arg === 'this.props.selectedComponent[0]') {
                    return j.memberExpression(j.memberExpression(j.identifier('props'), j.identifier('selectedComponent')), j.literal(0));
                }
                if (arg === 'this.props.selectedComponents[0]') {
                    return j.memberExpression(j.memberExpression(j.identifier('props'), j.identifier('selectedComponents')), j.literal(0));
                }
                throw `Unknown argument ${arg}`;
            });
        }

        return {
            hasReplacements: () => allReplacements.length > 0,
            memberReplaced: replacement => allReplacements.push(replacement),
            getProps: () => _(allReplacements)
                .keyBy('propName')
                .mapValues(x => {
                    const member = generateMemberFromArray('editorApi', x.pathFromEditorApi)
                    if (x.shouldInvoke) {
                        return j.callExpression(member, getArguments(x.arguments));
                    }
                    return member;
                })
                .value(),
            getPropTypes: () => _(allReplacements)
                .keyBy('propName')
                .mapValues((x, propName) => {
                    let type = !x.shouldInvoke ? 'func' : (propName.startsWith('is') ? 'bool' : 'object');
                    return generateMemberFromArray('React', ['PropTypes', type, 'isRequired']);
                })
                .value()
        };
    }();

    const onlyTail = ['panelManager'];

    function getPropName(pathFromEditorApi) {
        let pathSuffix = _.last(pathFromEditorApi);
        if (!_(pathFromEditorApi).intersection(onlyTail).isEmpty()) {
            return pathSuffix;
        }
        return _.takeRight(pathFromEditorApi, 2).join('-');
    }

    function getReplacement(path, editorApiVariableName) {
        const pathFromEditorApi = getPath(path.value, editorApiVariableName);
        const invocationStrategy = getInvocationStrategy(path, pathFromEditorApi)
        const propName = _.camelCase(
            invocationStrategy.shouldInvoke ?
                _.last(pathFromEditorApi).replace(/^(get)/, '') || _(pathFromEditorApi).dropRight().last() :
                getPropName(pathFromEditorApi));

        return {
            pathFromEditorApi,
            propName,
            ...invocationStrategy
        };
    }

    function getInvocationStrategy(path, pathFromEditorApi) {
        let pathSuffix = _.last(pathFromEditorApi);
        if (!_.some(['get', 'is'], prefix => pathSuffix.startsWith(prefix))) {
            return {shouldInvoke: false};
        }
        if (getParentType(path) !== 'CallExpression') {
            return {shouldInvoke: false};
        }
        const args = path.parentPath.value.arguments;
        if (args.length === 0) {
            return {shouldInvoke: true, arguments: []};
        }
        if (args.length === 1 && args[0].type === 'MemberExpression') {
            if (_.isEqual('this.props.selectedComponent'.split('.'), getPath(args[0]))) {
                return {shouldInvoke: true, arguments: ['this.props.selectedComponent']};
            }
            if (_.isEqual('this.props.selectedComponents'.split('.'), getPath(args[0]))) {
                return {shouldInvoke: true, arguments: ['this.props.selectedComponents']};
            }
            if (_.isEqual('this.props.selectedComponent.0'.split('.'), getPath(args[0]))) {
                return {shouldInvoke: true, arguments: ['this.props.selectedComponent[0]']};
            }
            if (_.isEqual('this.props.selectedComponents.0'.split('.'), getPath(args[0]))) {
                return {shouldInvoke: true, arguments: ['this.props.selectedComponents[0]']};
            }
        }
        return {shouldInvoke: false};
    }

    const getHighestMember = path => {
        let highestMember = path;
        while (highestMember.parentPath.value.type === 'MemberExpression') {
            highestMember = highestMember.parentPath;
        }
        return highestMember;
    };

    const getThisProps = propName =>
        j.memberExpression(
            j.memberExpression(j.thisExpression(), j.identifier('props')),
            j.identifier(propName));

    function getPath(node, stopAt) {
        if (node.type === 'ThisExpression') {
            return ['this'];
        }
        if (node.type === 'CallExpression' || (stopAt && node.name === stopAt)) {
            return [];
        }
        return getPath(node.object, stopAt).concat(node.property.name || node.property.raw);
    }

    const replaceToThisProps = (member, editorApiVariableName) => {
        const replacement = getReplacement(member, editorApiVariableName);
        replacements.memberReplaced(replacement);
        j(replacement.shouldInvoke ? member.parentPath : member)
            .replaceWith(() => getThisProps(replacement.propName));
    };

    function generateMemberFromArray(prop, pathArray) {
        return _.reduce(
            pathArray,
            (acc, val) => j.memberExpression(acc, j.identifier(val)),
            prop === 'this' ? j.thisE : j.identifier(prop));
    }

    function replaceAllEditorApiInCode(code) {
        code
            .find(j.CallExpression, {
                callee: {
                    object: {
                        type: 'ThisExpression',
                    },
                    property: {
                        type: 'Identifier',
                        name: 'getEditorAPI',
                    },
                },
            })
            .forEach(path => {
                const parentType = getParentType(path);
                if (parentType === 'VariableDeclarator') {
                    const variableName = path.parentPath.parentPath.value[0].id.name;
                    j(path)
                        .closest(j.BlockStatement)
                        .forEach(block => {
                            j(block)
                                .find(j.MemberExpression, {object: {name: variableName}})
                                .map(getHighestMember)
                                .forEach(member => replaceToThisProps(member, variableName));
                        });

                    j(path)
                        .closest(j.VariableDeclaration)
                        .forEach(variable => j(variable).remove());
                } else if (parentType === 'MemberExpression') {
                    const highestMember = getHighestMember(path);
                    j(highestMember)
                        .forEach(member => replaceToThisProps(member));
                }
            });
    }


    function getParentType(path) {
        return path.parentPath.value.type;
    }

    function replaceInRtFile(rtFile) {
        const doc = xmlDomUtils.parse(rtFile).documentElement;

        xmlDomUtils.traverseAttributes(doc, () => true, attribute => {
            const value = attribute.value;
            let name = attribute.name;
            let isComputed = value.startsWith('{') && value.endsWith('}');

            if (name === 'rt-scope') {
                return;
            }

            if (!isComputed && !name.startsWith('rt-')) {
                return;
            }

            const code = j(wrapWithFunction(isComputed ? value.replace(/(^\{|\}$)/g, '') : value));
            replaceAllEditorApiInCode(code);
            let newCode = code.toSource({quote: 'single'}).replace(/(^function yonti\(\)\{|;\}$)/g, '');
            attribute.ownerElement.setAttribute(name, isComputed ? `{${newCode}}` : newCode);
        });

        return xmlDomUtils.serialize(doc);
    }

    const rtFilePath = file.path.replace(/\.js$/, '.rt');

    if (!fs.existsSync(rtFilePath)) {
        return file.source;
    }

    const rtFile = fs.readFileSync(rtFilePath, 'utf8');

    const myFile = j(file.source);

    const newRtFile = replaceInRtFile(rtFile);
    if (process.env.NODE_ENV === 'test') {
        var rtOutputFile = fs.readFileSync(file.path.replace(/input\.js$/, 'output.rt'), 'utf8');
        expect(newRtFile.trim()).toEqual(rtOutputFile.trim());
    } else {
        if (replacements.hasReplacements()) {
            fs.writeFileSync(rtFilePath, newRtFile);
        }
    }

    // replace all this.getEditorAPI() calls with this.props and store them
    replaceAllEditorApiInCode(myFile);


    if (replacements.hasReplacements()) {
        let reactClass = myFile
            .find(j.CallExpression, {callee: {object: {name: 'React'}, property: {name: 'createClass'}}});

        // add mapEditorApiToProps and connect the component
        reactClass
            .filter(path => getParentType(path) === 'ReturnStatement')
            .map(path => path.parentPath)
            .replaceWith(path => j.variableDeclaration(
                'var', [j.variableDeclarator(j.identifier('Component'), path.value.argument)]))
            .forEach(path => {
                const parameterName = 'editorApi';
                const props = _.map(
                    replacements.getProps(),
                    (val, name) => j.property('init', j.identifier(name), val));
                const mapEditorApiToProps = j.functionDeclaration(
                    j.identifier('mapEditorApiToProps'),
                    [j.identifier(parameterName), j.identifier('props')],
                    j.blockStatement([
                        j.returnStatement(
                            j.objectExpression(props)
                        )
                    ]));

                const connect = j(connectTheComponent).find(j.BlockStatement).nodes()[0].body;

                let insertAtTheEndOfTheFile = [mapEditorApiToProps].concat(connect);
                j(path).insertAfter(insertAtTheEndOfTheFile);
            });

        reactClass
            .find(j.Property, {key: {name: 'render'}})
            .forEach(path => {
                const propTypesObj = _.map(
                    replacements.getPropTypes(),
                    (val, name) => j.property('init', j.identifier(name), val));

                j(path).insertAfter(j.property('init', j.identifier('propTypes'), j.objectExpression(propTypesObj)));
            })

        myFile
            .find(j.CallExpression, {callee: {name: 'define'}})
            .forEach(path => {
                path.value.arguments[0].elements.push(j.literal('higherOrderComponents'));
                path.value.arguments[1].params.push(j.identifier('higherOrderComponents'));
            })

        return myFile.toSource({quote: 'single'});
    } else {
        return file.source;
    }

}
