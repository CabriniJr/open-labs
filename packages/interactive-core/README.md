# @ovh/interactive-core

Pre-release deterministic event/state sessions for OpenLabs experiments.
No flow engine, Mermaid, renderer or domain dependency. Node.js 24 or a browser
with `structuredClone`.

```js
import { InteractiveSession } from "@ovh/interactive-core";

const model = {
  id: "counter",
  initial: () => ({ value: 0 }),
  transition: (state, event) => ({ value: state.value + event.delta }),
};
const session = new InteractiveSession(model, 100);
session.dispatch({ delta: 2 });
session.seek(0);
session.dispatch({ delta: 3 }); // a new branch replaces the old future
```

States and events must be cloneable. Time and randomness belong in explicit
events. The model supplies domain rules; the session does not prescribe them.
The root state is exposed as shallow `Readonly` in TypeScript; consumers must
treat nested values as immutable too.

This alpha API may change. It is the runtime used by the Pod lifecycle POC,
not a distribution of Kubernetes, its lab UI, or the compositional flow engine.

Apache-2.0.
