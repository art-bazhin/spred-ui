const SUBS_KEY = '$subs';

export function insertBefore(child: Node, mark: Node) {
  const parent = mark.parentNode;

  if (!parent) return;
  parent.insertBefore(child, mark);
}

export function removeNodes(start: Node, end: Node) {
  if (!start || !end) return;

  const parent = start.parentNode!;

  let current: Node | null = start;
  let next: Node | null = null;

  while (current && current !== end) {
    cleanupSubs(current);
    next = current.nextSibling;
    parent.removeChild(current);
    current = next;
  }
}

export function isFragment(node: Node): node is DocumentFragment {
  return node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}

export function addSub(node: Node, sub: () => any) {
  let subs = (node as any)[SUBS_KEY];

  if (!subs) {
    subs = [];
    (node as any)[SUBS_KEY] = subs;
  }

  subs.push(sub);
}

function cleanupSubs(node: Node) {
  const subs: (() => void)[] = (node as any)[SUBS_KEY];

  if (subs) {
    for (let unsub of subs) unsub();
    delete (node as any)[SUBS_KEY];
  }

  let child = node.firstChild;

  while (child) {
    cleanupSubs(child);
    child = child.nextSibling;
  }
}
