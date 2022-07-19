import { isSignal, Signal } from 'spred';

let root: Node | null = null;
let isCreating = false;
let mountedNode: Node[] = [];

let path: string | null = null;
let pathStack: any[] = [];

let lastChild = null as any;

function next(fn?: () => any) {
  const state = pathStack[0];

  if (!state) return;

  const current = state.path[state.i];
  const nextValue = state.path[++state.i];
  const goDeeper = nextValue === 's';

  switch (current) {
    case '_':
      if (goDeeper) {
        ++state.i;
        fn && fn();
      }
      break;

    case 'f':
      state.node = state.node.firstChild;
      if (goDeeper) {
        ++state.i;
        fn && fn();
      }
      break;

    case 'n':
      state.node = state.node.nextSibling;
      if (goDeeper) {
        ++state.i;
        fn && fn();
      }
      break;

    case 'l':
      state.node = lastChild.nextSibling;
      if (goDeeper) {
        ++state.i;
        fn && fn();
      }
      break;

    case 'p':
      lastChild = state.node;
      state.node = state.node.parentNode;
      next(fn);
      break;
  }
}

function push(el: any) {
  root = el;
  return root;
}

function pop() {
  root = root!.parentNode;
  return root;
}

export function tag(tag: string, fn?: () => any) {
  if (isCreating) {
    if (!root) return;

    const child = document.createElement(tag);

    root.appendChild(child);

    push(child);
    path += 'f';

    if (fn) {
      path += 's';
      fn && fn();
      path += 'e';
    }

    path += 'p';
    pop();

    return;
  }

  next(fn);

  return;
}

export function attr(key: string, value: string | (() => string)) {
  if (isCreating && !root) return;

  const isFn = typeof value === 'function';

  if (!isFn) {
    if (!isCreating) return;
    (root as HTMLElement).setAttribute(key, value);
    return;
  }

  if (isCreating) {
    const node = root;

    path += 'b';

    if (isSignal(value)) {
      value.subscribe((v) => (node as HTMLElement).setAttribute(key, v));
      return;
    }

    (node as HTMLElement).setAttribute(key, value());

    return;
  }

  next();

  const node = pathStack[0].node;

  if (isSignal(value)) {
    value.subscribe((v) => (node as HTMLElement).setAttribute(key, v));
    return;
  }

  (node as HTMLElement).setAttribute(key, value());
}

const EVENTS = {} as any;

function eventListener(e: Event) {
  const key = '$$' + e.type;
  let node = e.target as any;

  while (node) {
    const handler = node[key];

    if (handler) {
      handler(e);
      if (e.cancelBubble) return;
    }

    node = node.parentNode;
  }
}

function delegate(event: string) {
  if (EVENTS[event]) return;

  EVENTS[event] = true;

  document.addEventListener(event, eventListener);
}

export function listener(event: string, listener: (...args: any) => any) {
  if (isCreating) {
    path += 'b';

    (root as any)['$$' + event] = listener;
    delegate(event);

    return;
  }

  next();

  const node = pathStack[0].node;

  node['$$' + event] = listener;

  delegate(event);
}

export function text(str: string | (() => string)) {
  if (isCreating && !root) return;

  const isFn = typeof str === 'function';

  if (isCreating) {
    const node = document.createTextNode('_');

    root!.appendChild(node);

    if (isFn) {
      path += 'fbp';

      if (isSignal(str)) {
        str.subscribe((v) => (node.textContent = v));
        return;
      }

      node.textContent = str();
    } else {
      path += 'fp';
      node.textContent = str;
    }

    return;
  }

  next();

  if (isFn) {
    const node = pathStack[0].node;
    next();

    if (isSignal(str)) {
      str.subscribe((v) => ((node as any).textContent = v));
      return;
    }

    (node as any).textContent = str();

    return;
  }
}

const setupQueue: any[] = [];

type Props = {
  [key: string]: () => unknown;
} | void;

export type Component<P extends Props> = ((props: P) => void) & {
  $$isComponent: true;
};

export function createComponent<P extends Props>(fn: (props: P) => any) {
  let template: Node | undefined;
  let fragment: Node | undefined;
  let pathString = '';

  const component: any = function (props: P) {
    next();

    const state = pathStack[0];
    const node = state && state.node;

    let isFirstRender = false;

    if (!node && !mountedNode[0]) return;

    if (isCreating && root) {
      path += 'fbp';

      const mark = document.createComment('');
      setupQueue.push({ mark, binding: () => component(props) });

      root.appendChild(mark);
      return;
    }

    if (!template) {
      isFirstRender = true;
      path = pathString;

      const tempRoot = root;
      fragment = document.createDocumentFragment();

      isCreating = true;
      push(fragment);

      fn(props);

      isCreating = false;
      push(tempRoot);

      pathString = path
        .replace(/pf/g, 'n')
        .replace(/p(b+)f/g, (_, str) => {
          return 'p' + str + 'l';
        })
        .replace(/pb/g, 'xb');

      let temp = '' as any;
      pathString = pathString;

      while (temp !== pathString) {
        temp = pathString;
        pathString = pathString
          .replace(/^([^bse]*)$/g, '')
          .replace(/s([^bse]*)e/g, '');
      }
      pathString = pathString
        .replace(/f(n*)p/g, (str) => {
          return 'r'.repeat(str.length - 1);
        })
        .replace(/(n+)p/g, (str) => {
          return 'r'.repeat(str.length - 1) + 'p';
        })
        .replace(/e/g, '')
        .replace(/x/g, 'p')
        .replace(/([rp]+)$/g, '');

      path = null;

      if (fragment.childNodes.length === 1) {
        fragment = fragment.firstChild!;
        if (pathString[0] === 'f') pathString = '_' + pathString.substring(1);
        // console.log(pathString.split(''));
      }

      template = fragment.cloneNode(true);
    }

    const container: any = mountedNode[0];

    if (mountedNode[0]) {
      mountedNode.shift();
    } else {
      next();
    }

    const clone = isFirstRender ? fragment : template.cloneNode(true);

    if (!isFirstRender) {
      pathStack.unshift({
        path: pathString,
        i: 0,
        node: clone,
      });

      fn(props);

      pathStack.shift();
    }

    isFirstRender = false;

    while (setupQueue.length) {
      const { mark, binding } = setupQueue.shift();

      if (isSignal(binding)) {
        setupBinding(binding as any, mark);
      } else {
        const content = document.createDocumentFragment();

        mount(content, binding);
        insertBefore(mark, content);
      }
    }

    if (!container && node) {
      const parent = node!.parentNode!;
      parent.insertBefore(clone, node);
      return;
    }

    if (container) container.appendChild(clone);

    return;
  };

  component.$$isComponent = true;

  return component as Component<P>;
}

export function bind(binding: Signal<Component<void>>) {
  next();

  if (isCreating && root) {
    path += 'fbp';

    const mark = document.createComment('');

    setupQueue.push({ mark, binding });

    root.appendChild(mark);
    return;
  }

  const state = pathStack[0];
  const mark = state && state.node;

  setupBinding(binding, mark);
}

function setupBinding(binding: Signal<Component<void>>, mark: Node) {
  const content = document.createDocumentFragment();

  let start: Node | null = null;
  let end: Node | null = null;

  binding.subscribe((res: any) => {
    if (start && end) removeNodes(start, end);

    mount(content, res);

    start = content.firstChild;
    end = content.lastChild;

    insertBefore(mark, content);
  });
}

export function mount(el: Node, component: Component<void>) {
  mountedNode.unshift(el);
  component();
}

function mountBefore(el: Node, fn: () => any) {
  const fragment = document.createDocumentFragment();

  mountedNode.unshift(fragment);
  fn();

  insertBefore(el, fragment);
}

function insertBefore(mark: Node, child: Node) {
  const parent = mark.parentNode;

  if (!parent) return;
  parent.insertBefore(child, mark);
}

function removeNodes(start: Node, end: Node) {
  if (!start || !end) return;

  const parent = start.parentNode!;

  let current: Node | null = start;
  let next: Node | null = null;

  while (current && current !== end) {
    next = current.nextSibling;
    parent.removeChild(current);
    current = next;
  }

  if (current) parent.removeChild(current);
}

const Test = createComponent<{
  test: () => number;
}>((props) => {
  props.test();
});

// mount(document.getElementById('123')!, Test);
