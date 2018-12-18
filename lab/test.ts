// This file just for test

import convert from '../src'


// const lierStr = `
// # ddd
// {
//     code: int
//     # dddd
//     data: AppKitBannerForCollect
//     msg: str
//     success: bool
// }
// `

const lierStr = `
{
    @range(1,3)
    a: int
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


