/** Let the browser render/handle input between chunks of heavy work. */
export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
