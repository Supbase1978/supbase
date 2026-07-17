/** Apró, függőség nélküli class-name összefűző (feltételes osztályokhoz). */
export function cx(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
