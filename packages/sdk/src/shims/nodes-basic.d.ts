declare module "@open-harness/nodes-basic" {
  // NOTE: This shim exists to prevent TypeScript from typechecking the workspace
  // source for @open-harness/nodes-basic during @open-harness/sdk declaration builds.
  // The real package is a peer dependency at runtime.
  export const constantNode: unknown;
  export const echoNode: unknown;
}
