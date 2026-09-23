/**
 * On phones, entering the game goes fullscreen and asks for landscape. Both are best-effort: iOS
 * Safari supports neither for web pages, so the game also shows a rotate prompt in portrait.
 */
export async function enterImmersive(): Promise<void> {
	if (typeof window === 'undefined' || !matchMedia('(pointer: coarse)').matches) return;
	try {
		if (!document.fullscreenElement)
			await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
	} catch {
		/* not allowed — fine */
	}
	try {
		const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
		await o.lock?.('landscape');
	} catch {
		/* unsupported — the rotate prompt covers it */
	}
}
