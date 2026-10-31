export async function localResult<T, K extends string>(
  action: () => T,
  key: K,
): Promise<({ ok: true } & Record<K, T>) | { ok: false; message: string }> {
  try {
    return { ok: true, [key]: action() } as { ok: true } & Record<K, T>
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir a operação local.',
    }
  }
}
