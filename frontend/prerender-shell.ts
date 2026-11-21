/**
 * HTML-first shell: the static top of the key pages, written into index.html at build time so the
 * headline paints before the JavaScript has downloaded (the app is a single-page app, so without
 * this nothing paints until the core bundle runs).
 *
 * Every fragment must match React's FIRST render of that route exactly (same elements, classes and
 * text, including loading states), so swapping in the real app shifts nothing. e2e/shell.spec.ts
 * fails if it does. No API data is ever written here: where the first render shows a loading
 * skeleton, so does the shell.
 */

const SKIP = `<a class="skip-link" href="#main">Skip to content</a>`;

const NAV_LINK = "rounded-[var(--r-control)] px-3 py-2 text-sm no-underline text-text-2 hover:text-text";
const ACTIVE_NAV_LINK = "rounded-[var(--r-control)] px-3 py-2 text-sm no-underline text-text font-semibold";
const BUTTON = "inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] px-4 h-10 text-sm font-semibold no-underline transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
const TEXT_LINK = "font-medium text-text underline decoration-line-strong decoration-1 underline-offset-[3px] hover:decoration-text ";

const HEADER = `<header class="border-b border-line"><div class="page flex h-14 items-center gap-4"><a class="inline-flex items-center gap-2 text-text no-underline" aria-label="Diverge home" href="/"><svg viewBox="0 0 24 20" class="h-5 w-6" aria-hidden="true" fill="none" stroke-linecap="round"><path d="M1 10 H10" stroke="currentColor" stroke-width="2.2"></path><path d="M10 10 C15 10 17 4 23 3" stroke="var(--up)" stroke-width="2.6"></path><path d="M10 10 C15 10 17 16 23 17" stroke="var(--down)" stroke-width="1.8"></path></svg><span class="text-[1.0625rem] font-semibold tracking-[-0.02em]">Diverge</span></a><nav aria-label="Main" class="ml-6 hidden items-center gap-1 md:flex"><a class="${NAV_LINK}" href="/market">Market</a><a class="${NAV_LINK}" href="/model">Accuracy</a><a class="${NAV_LINK}" href="/method">Method</a></nav><div class="ml-auto flex items-center gap-1"><button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-control)] text-text-2 hover:bg-sunk hover:text-text" aria-label="Switch theme"><svg viewBox="0 0 20 20" class="h-[18px] w-[18px]" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"></circle><path d="M10 3.5 A6.5 6.5 0 0 1 10 16.5 Z" fill="currentColor"></path></svg></button><a class="${NAV_LINK} hidden md:inline-flex" href="/login">Sign in</a><button type="button" class="rounded-[var(--r-control)] px-3 py-2 text-sm text-text md:hidden" aria-expanded="false">Menu</button></div></div></header>`;

const DEMO_BAND = `<div class="hatch border-b border-line-strong"><p class="page py-2 text-[0.8125rem] text-text"><strong class="font-semibold">Demo data.</strong> <span class="text-text-2">Per-ticker values are illustrative, not live readings. The accuracy page shows the real model's test results.</span></p></div>`;

const skeleton = (cls: string, label?: string) =>
  label ? `<div class="skeleton ${cls}" role="status" aria-label="${label}" aria-busy="true"></div>` : `<div class="skeleton ${cls}"></div>`;

/** Route -> the static top of that page, as React first renders it. */
export const PAGES: Record<string, string> = {
  "/": `<section class="grid gap-12 pb-20 pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:pt-20"><div class="lg:pt-6"><h1 class="t-display">Tomorrow, read from today's chatter.</h1><p class="t-lead mt-6">Diverge reads public posts about a set of stocks on Dalal Street and Wall Street, discounts the ones that look bot-driven, and gives each a next-day call: the chance it closes higher and how big a move to expect. Every call shows its reasons and how often calls like it have been right.</p><div class="mt-8 flex flex-wrap items-center gap-3"><a class="${BUTTON} bg-text text-bg hover:bg-text-2 " href="/market">See every call</a><a class="${BUTTON} border border-edge text-text hover:bg-sunk " href="/model">How accurate is it?</a></div></div>${skeleton("mt-[4.5rem] aspect-[56/30] w-full", "Loading a live outlook")}</section>`,
  "/market": `<header class="grid gap-6 border-b border-line pb-8 pt-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end"><div><h1 class="t-h1">Market</h1><p class="t-lead mt-3">Every tracked stock with its next-day call, the move to expect, how loud the conversation is and how likely it is to be coordinated.</p><div class="mt-3 min-h-[4.5rem] lg:min-h-[3rem]">${skeleton("h-5 w-2/3", "Loading outlooks")}</div></div><p class="t-small lg:text-right">Direction calls are close to chance. <a class="${TEXT_LINK}" href="/model">See the track record</a></p></header>`,
  "/model": `<header class="max-w-[880px] pb-10 pt-12"><h1 class="t-display">Checked against days it had never seen.</h1>${skeleton("mt-6 h-16 max-w-[62ch]", "Loading the track record")}</header>`,
  "/method": `<header class="max-w-[860px] pb-10 pt-12"><h1 class="t-display">How Diverge turns chatter into a call.</h1><p class="t-lead mt-6">The short version: collect public posts, score them, discount anything that looks coordinated, and estimate tomorrow with a model whose track record is published next to every call.</p></header>`,
};

/** Markup for #root plus a tiny inline script that picks the page fragment before first paint. */
export function shellHtml(isDemo: boolean): string {
  const root = `<div id="root">${SKIP}${HEADER}${isDemo ? DEMO_BAND : ""}<main id="main" tabindex="-1" class="min-h-screen outline-none"><div class="page" id="shell-page"></div></main></div>`;
  // Also marks the current page's nav link the way React does, so the nav doesn't reflow on mount.
  const pick = `<script>(function(){var p=location.pathname.replace(/\\/+$/,"")||"/";var m=${JSON.stringify(PAGES)};var el=document.getElementById("shell-page");if(m[p]&&el)el.innerHTML=m[p];var a=document.querySelectorAll('nav[aria-label="Main"] a');for(var i=0;i<a.length;i++){if(a[i].getAttribute("href")===p){a[i].setAttribute("aria-current","page");a[i].className=${JSON.stringify(ACTIVE_NAV_LINK)};}}})();</script>`;
  return root + pick;
}

export function isDemoBuild(apiBaseUrl: string | undefined): boolean {
  return !apiBaseUrl || apiBaseUrl === "mock" || apiBaseUrl.startsWith("mock:");
}
