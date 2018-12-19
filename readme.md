## lier2typescript

Compile lier to typescript typings

## USAGE

```bash
npm i lier2ts
```

```javascript
import * as lier2ts from 'lier2ts'
// or const lier2ts = require('lier2ts')


const lierStr = `
{
    a: int
    b: {
        a: str[]
    }
}
`

const result = lier2ts.convert(lierStr, {})

```

## Options

```typescript
CompilerOptions {
    /** default is space */
    intentType?: 'tab' | 'space'
    /** default is 4 */
    intentSize?: number
    /** default is true */
    strictGenerate?: boolean
}
```

## LICENSE
MIT
