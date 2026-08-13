/**
 * Domain-neutral operation dispatch.
 *
 * Registers handlers by operation ID and executes them against caller-provided
 * state. Domain modules supply the handlers; this module does not know what
 * those operations mean.
 */

export type OperationRequest<TArgs = unknown> = {
  operationId: string;
  arguments: TArgs;
};

export type OperationHandler<
  TState,
  TRequest extends OperationRequest = OperationRequest,
  TResult = unknown,
> = (state: TState, request: TRequest) => TResult | null;

export type OperationEngine<
  TState,
  TRequest extends OperationRequest = OperationRequest,
  TResult = unknown,
> = {
  has(operationId: string): boolean;
  execute(state: TState, request: TRequest): TResult | null;
};

export function createOperationEngine<
  TState,
  TRequest extends OperationRequest = OperationRequest,
  TResult = unknown,
>(options: {
  handlers?: Readonly<Record<string, OperationHandler<TState, TRequest, TResult>>>;
  fallback?: OperationHandler<TState, TRequest, TResult>;
}): OperationEngine<TState, TRequest, TResult> {
  const handlers = options.handlers ?? {};
  return {
    has(operationId: string): boolean {
      return Object.prototype.hasOwnProperty.call(handlers, operationId);
    },
    execute(state: TState, request: TRequest): TResult | null {
      const handler = handlers[request.operationId] ?? options.fallback;
      if (!handler) return null;
      return handler(state, request);
    },
  };
}
