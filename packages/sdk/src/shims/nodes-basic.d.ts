declare module "@internal/nodes-basic" {
  // NOTE: This shim exists to prevent TypeScript from typechecking the workspace
  // source for @internal/nodes-basic during @open-harness/sdk declaration builds.
  // The real package is a workspace dependency at build time.
  export const constantNode: unknown;
  export const echoNode: unknown;
}
