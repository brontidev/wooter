// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'wooter',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/bronti/wooter' }, { icon: "jsr", label: "JSR", href: "https://jsr.io/@bronti/wooter" }],
			sidebar: [
			    { label: 'Overview', slug: "" },
				{
					label: 'Guide',
					autogenerate: { directory: 'guide' },
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
