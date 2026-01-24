/**
 * Type declarations for gray-matter package
 * Since @types/gray-matter doesn't exist, we provide minimal type definitions
 * for our use case (parsing YAML frontmatter from markdown files)
 */

declare module "gray-matter" {
	interface GrayMatterFile<T> {
		/** Original content string */
		content: string;
		/** Parsed data from YAML frontmatter */
		data: T;
		/** Excerpt if defined in options */
		excerpt?: string;
		/** Original input string */
		orig: Buffer | string;
		/** Language of the frontmatter (default: yaml) */
		language?: string;
		/** Frontmatter delimiters */
		matter?: string;
		/** String before frontmatter */
		stringify?: string;
	}

	interface GrayMatterOption<T> {
		/** Excerpt function or boolean */
		excerpt?:
			| boolean
			| ((file: GrayMatterFile<T>, options: GrayMatterOption<T>) => string);
		/** Excerpt separator */
		excerpt_separator?: string;
		/** Custom engines */
		engines?: Record<string, (input: string) => unknown>;
		/** Language to use */
		language?: string;
		/** Custom delimiters */
		delimiters?: string | [string, string];
	}

	/**
	 * Parse frontmatter from a string or buffer
	 * @param input The string or buffer to parse
	 * @param options Options for parsing
	 * @returns Parsed file object with data and content
	 */
	function matter<T = Record<string, unknown>>(
		input: string | Buffer,
		options?: GrayMatterOption<T>
	): GrayMatterFile<T>;

	export = matter;
}
