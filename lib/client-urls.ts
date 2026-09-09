export function sceneUrl(path: string | null) {
  if (!path) return "";
  return process.env.NEXT_PUBLIC_SOCKET_URL
    ? new URL(path, process.env.NEXT_PUBLIC_SOCKET_URL).toString()
    : path;
}
