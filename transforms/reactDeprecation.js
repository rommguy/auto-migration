/* eslint-disable indent */
const {isEmpty, findIndex} = require('lodash/fp');

// jscodeshift -t ./transforms/reactDeprecation.js /Users/guyr/projects/santa-editor/packages/rEditor/src/main

export default function transformer(file, api) {
    const j = api.jscodeshift;

    const myFile = j(file.source);

    // prop types
    const propTypes = myFile
        .find(j.MemberExpression, {object: {name: 'React'}, property: {name: 'PropTypes'}})
    const createClass = myFile
        .find(j.MemberExpression, {object: {name: 'React'}, property: {name: 'createClass'}})
    const otherReactUsage = myFile
        .find(j.MemberExpression, {object: {name: 'React'}})
        .filter(path => path.value.property.name !== 'createClass' && path.value.property.name !== 'PropTypes').size() > 0

    if (propTypes.size()) {
        // add dependency

        // replace propTypes usage
        propTypes.replaceWith(j.identifier('PropTypes'))
    }


    // dependencies
    myFile
        .find(j.ArrayExpression)
        .forEach(path => {
            const requireReact = j(path).find(j.Literal, {value: 'react'});
            if (requireReact.size()) {
                if (createClass.size() && !otherReactUsage) {
                    requireReact.replaceWith(() => j.literal('create-react-class'));
                    if (propTypes.size()) {
                        requireReact.forEach(r => j(r).insertAfter(j.literal('prop-types')))
                    }
                } else if (createClass.size()) {
                    if (propTypes.size()) {
                        requireReact.forEach(r => j(r).insertAfter(j.literal('prop-types')))
                    }
                    requireReact.forEach(r => j(r).insertAfter(j.literal('create-react-class')))
                }



            }
        })

    myFile
        .find(j.FunctionExpression)
        .filter(path => !isEmpty(path.value.params))
        .forEach(path => {
            const reactArgIndex = findIndex({name: 'React'})(path.value.params)
            if (reactArgIndex > -1) {
                if (createClass.size() && !otherReactUsage) {
                    path.value.params[reactArgIndex].name = 'createReactClass'
                    if (propTypes.size()) {
                        path.value.params.splice(reactArgIndex + 1, 0, j.identifier('PropTypes'))
                    }
                } else if (createClass.size()) {
                    path.value.params.splice(reactArgIndex + 1, 0, j.identifier('createReactClass'))
                    if (propTypes.size()) {
                        path.value.params.splice(reactArgIndex + 2, 0, j.identifier('PropTypes'))
                    }
                }
            }
        })


    // createReactClass usage
    if (createClass.size()) {
        createClass
            .replaceWith(() => {
                return j.identifier('createReactClass');
            });
    }


    return myFile.toSource({quote: 'single'});
}
