import * as lier from 'lier'
import { Node, Type } from 'lier/src/grammar/interface'
import Table, {CompilerOptions} from './table'


export default (lierStr: string, opt?: CompilerOptions): string => {
    const ast: Node[] = lier.parse(lierStr)

    const compiler = new Table(opt)

    return compiler.start(ast)
}
