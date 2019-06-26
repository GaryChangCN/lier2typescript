import * as Grammer from 'lier/src/grammar/interface'
import mapping from './mapping'
import * as _ from 'lodash'



export class Context {
    root = null
}

export interface CompilerOptions {
    intentType?: 'tab' | 'space'
    intentSize?: number
    /** 默认为 false，不支持的转换会使用 any 替代 */
    strictGenerate?: boolean
}

const defaultOptions: CompilerOptions = {
    intentType: 'space',
    intentSize: 4,
    strictGenerate: false
}

/** 详细类型 */
enum SubType {
    key = 'key',
    value = 'value'
}

/** 传递的其他值 */
type RouterDeploy = {
    depth?: number
    subType?: SubType
}




// tslint:disable-next-line:max-classes-per-file
class Table {
    option: CompilerOptions
    ctx: Context

    constructor (option = defaultOptions) {
        this.option = _.assign({}, defaultOptions, option)
        this.ctx = new Context()
    }

    /** 获取 intent */
    private getPrefix (depth: number) {
        if (depth < 0) {
            depth = 0
        }
        const intent = this.option.intentType === 'space' ? ' ' : '\t'
        const repeat = this.option.intentSize * depth
        return _.repeat(intent, repeat)
    }

    /** 首字母大写 */
    private upperFirst (input: string) {
        return input.slice(0, 1).toUpperCase() + input.slice(1)
    }

    private router = (node: Grammer.Node, deploy?: RouterDeploy): string => {
        if (!node) {
            return node as any
        }

        const handle = this[node.type]
        if (!handle) {
            return node as any
        }

        return handle(node, deploy)
    }

    start = (ast: Grammer.Node[]) => {
        this.ctx.root = ast

        const ret = []
        for (const node of ast) {
            ret.push(this.router(node))
        }
        return ret.join('\n')
    }

    [Grammer.Type.unary] = (node: Grammer.UnaryNode) => {

        const operator = node.operator
        const arg = this.router(node.argument)

        return arg
    }

    [Grammer.Type.member] = (node: Grammer.MemberNode) => {
        if (node.properties.length > 0 && this.option.strictGenerate) {
            throw new Error('not support point joiner')
        }
        const ns = this.router(node.object)

        if (node.properties.length === 0) {
            return ns
        }

        const ret: string[] = [ this.upperFirst(ns) ]

        node.properties.forEach(item => {
            ret.push(this.router(item))
        })

        return ret.join('')
    }

    [Grammer.Type.binary] = (node: Grammer.BinaryNode) => {
        const left = this.router(node.left)
        const right = this.router(node.right)


        if (node.operator === '|') {
            return `${left} | ${right}`
        } else {
            if (this.option.strictGenerate) {
                throw new Error('not support binary operator' + node.operator)
            }
            return 'any'
        }
    }

    [Grammer.Type.property] = (node: Grammer.PropertyNode, deploy?: RouterDeploy) => {
        const key = this.router(
            node.key,
            {subType: SubType.key}
        )
        const value = this.router(
            node.value,
            {...deploy, subType: SubType.value}
        )
        const optional = node.optional ? '?' : ''
        return `${key}${optional}: ${value}`
    }


    [Grammer.Type.object] = (node: Grammer.ObjectNode, deploy?: RouterDeploy) => {
        const innerDeploy: RouterDeploy = {
            depth: 1
        }
        if (deploy && deploy.depth) {
            innerDeploy.depth += deploy.depth
        }

        const lines: string[] = []
        const prefix = this.getPrefix(innerDeploy.depth)

        // 处理是空对象情况，空对象转成 any
        if (node.properties.length === 0) {
            return 'any'
        }

        for (const property of node.properties) {

            // 处理 $rest 情况
            if (property.type === Grammer.Type.property) {
                const innerNode = property as Grammer.PropertyNode
                if ((innerNode.key as any).value === '$rest') {
                    // $rest: never
                    if ((innerNode.value as any).value === 'never') {
                        continue
                    }
                    // $rest: int 之类
                    const inner2Deploy: RouterDeploy = {
                        depth: 0
                    }
                    if (innerDeploy && innerDeploy.depth) {
                        inner2Deploy.depth += innerDeploy.depth
                    }
                    const v = this.router((innerNode.value as any), inner2Deploy)
                    const kv1 = `[key: string]: ${v}`
                    lines.push(prefix + kv1)
                    continue
                }
            }


            const kv = this.router(property, innerDeploy)

            lines.push(prefix + kv)
        }

        if (!lines.length) {
            return ''
        }


        lines.unshift('{')
        lines.push(this.getPrefix(innerDeploy.depth - 1) + '}')

        return lines.join('\n')
    }

    [Grammer.Type.enum] = (node: Grammer.EnumNode) => {

        const ret: number[] = []

        let prev: number

        for (const item of node.arguments) {
            const innerNode = item as any
            if (innerNode.type !== Grammer.Type.item) {
                return 'any'
            }

            if (prev === undefined) {
                if (innerNode.value === undefined) {
                    ret.push(0)
                    prev = 0
                    continue
                }

                ret.push(innerNode.value)
                prev = innerNode.value
                continue
            }

            prev ++
            ret.push(prev)
        }

        return ret.join(' | ')
    }

    [Grammer.Type.match] = (node: Grammer.MatchNode) => {
        if (this.option.strictGenerate) {
            throw new Error ('not support match type')
        }
        return 'any'
    }


    [Grammer.Type.self] = (node: Grammer.SelfNode) => {
        if (this.option.strictGenerate) {
            throw new Error(`not support self grammer`)
        }
        return 'any'
    }

    [Grammer.Type.call] = (node: Grammer.CallNode) => {
        // 处理 definition 情况
        if (node.callee.type === Grammer.Type.identifier && (node.callee as any).value === 'definition') {
            const arg = node.arguments[0]
            if (!arg) {
                if (this.option.strictGenerate) {
                    throw new Error('not support definition without params')
                } else {
                    return 'any'
                }
            }
            const ret = this.router(arg)
            return ret
        }

        return ''
    }

    [Grammer.Type.array] = (node: Grammer.ArrayNode, deploy?: RouterDeploy) => {
        const value = this.router(node.value, deploy)
        if (node.value.type === Grammer.Type.unary || node.value.type === Grammer.Type.binary) {
            return `(${value})[]`
        }
        return `${value}[]`
    }

    [Grammer.Type.identifier] = (node: Grammer.IdentifierNode, deploy?: RouterDeploy) => {

        if (deploy) {
            if (deploy.subType === SubType.key) {
                return node.value
            }
            if (deploy.subType === SubType.value) {
                if (node.value === 'never') {
                    if (this.option.strictGenerate) {
                        throw new Error ('not support identifier: never')
                    } else {
                        return 'any'
                    }
                }
            }
        }

        return mapping[node.value] || node.value
    }

    [Grammer.Type.null] = (node: Grammer.NullNode) => {
        return 'null'
    }


    [Grammer.Type.boolean] = (node: Grammer.BooleanNode) => {
        return node.value
    }

    [Grammer.Type.number] = (node: Grammer.NumberNode) => {
        return node.value
    }

    [Grammer.Type.string] = (node: Grammer.StringNode) => {
        return `'${node.value}'`
    }

    [Grammer.Type.regular] = (node: Grammer.RegularNode, deploy: RouterDeploy) => {
        if (this.option.strictGenerate) {
            throw new Error('not support regular type')
        }
        if (deploy && deploy.subType) {
            if (deploy.subType === SubType.key) {
                return `[key: str]`
            }
        }
        return 'string'
    }


    [Grammer.Type.tuple] = (node: Grammer.TupleNode, deploy?: RouterDeploy) => {
        if (!node.value.length) {
            return '[]'
        }

        const subDeply: RouterDeploy = {
            depth: 1
        }
        if (deploy && deploy.depth) {
            subDeply.depth += deploy.depth
        }
        const prefix = this.getPrefix(subDeply.depth)

        const arrs = node.value.map(item => {
            return prefix + this.router(item, subDeply)
        })
        return `[\n${arrs.join(`,\n`)}\n${this.getPrefix(subDeply.depth - 1)}]`
    }

    [Grammer.Type.rest] = (node: any) => {
        return
    }

    [Grammer.Type.optional] = (node: any) => {
        return this.router(node.value)
    }

    [Grammer.Type.element] = (node: Grammer.ElementNode) => {
        const lines: string[] = []

        node.declarations.forEach(item => {
            lines.push(this.router(item) + '\n')
        })


        lines.push(this.router(node.assignment))
        return lines.join('\n')
    }

    [Grammer.Type.comment] = (node: Grammer.CommentNode, deploy?: RouterDeploy) => {
        const val = node.value.trim()
        // 单行注释
        if (!/\n/.test(val)) {
            return `/** ${val} */`
        }

        let prefix = ''
        if (deploy && deploy.depth) {
            prefix = this.getPrefix(deploy.depth)
        }

        const vals = val.split(/\n/)
        const deal = vals.map(item => {
            return `${prefix} * ${item.trim()}`
        }).join('\n')

        const ret = `/**\n${deal}\n${prefix} */`
        return ret
    }

    [Grammer.Type.declare] = (node: Grammer.DeclareNode) => {
        const paths: string[] = node.path.map(item => this.upperFirst(this.router(item)))

        const ns = paths.join('')
        const val = this.router(node.value)
        return `export interface ${ns} ${val}`
    }

    [Grammer.Type.path] = (node: Grammer.PathNode) => {
        const val = this.router(node.value)
        return this.upperFirst(val)
    }

    // [Grammer.Type.item] = (node: any) => {
    //     if (node.value === null) {
    //         return `${node.name}`
    //     }
    //     return `${node.name} = ${node.value}`
    // }


}


export default Table
