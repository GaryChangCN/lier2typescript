// This file just for test

import convert from '../src'

const lierStr = `
{
    a: int
    b: {
        a: str[]
    }
}
`


// tslint:disable-next-line:no-console
console.log('\n\n------- start ---------\n')

const ret = convert(lierStr, {
    intentSize: 4
})


// tslint:disable-next-line:no-console
console.log('\nresult:\n')
// tslint:disable-next-line:no-console
console.log(ret)


