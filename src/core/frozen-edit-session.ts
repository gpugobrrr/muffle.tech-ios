/**
 * Domain-neutral frozen edit-session / commit-target primitive.
 *
 * The target captured when editing begins remains the commit target until
 * commit or cancel. Later UI selection must not replace it.
 */

export type FrozenEditSession<TTarget> = {
  path: readonly string[];
  token: string;
  target: TTarget;
};

export function openFrozenEditSession<TTarget>(
  path: readonly string[],
  target: TTarget,
  token?: string,
): FrozenEditSession<TTarget> {
  return {
    path: [...path],
    token: token ?? path[path.length - 1] ?? '',
    target,
  };
}

export function frozenEditSessionPathKey(
  session: FrozenEditSession<unknown> | null | undefined,
): string | null {
  if (!session?.path.length) return null;
  return session.path.join('/');
}

/**
 * Prefer the frozen session target over any later live selection.
 */
export function resolveFrozenCommitTarget<TTarget>(
  session: FrozenEditSession<TTarget> | null | undefined,
  fallback?: TTarget | null,
): TTarget | null {
  if (session?.target) return session.target;
  return fallback ?? null;
}
