/**
 * ControlPanel Component
 *
 * Displays available keyboard shortcuts and controls.
 */

import blessed from "blessed";
import type contrib from "blessed-contrib";
import { colors } from "../theme.js";

export class ControlPanel {
	private box: blessed.Widgets.BoxElement;
	private expanded = false;

	constructor(grid: contrib.grid, row: number, col: number, rowSpan: number, colSpan: number) {
		this.box = grid.set(row, col, rowSpan, colSpan, blessed.box, {
			label: " Controls ",
			border: "line",
			tags: true,
			style: {
				border: { fg: colors.border },
			},
		}) as blessed.Widgets.BoxElement;

		this.render();
	}

	/**
	 * Toggle between compact and expanded view.
	 */
	toggleExpanded(): void {
		this.expanded = !this.expanded;
		this.render();
	}

	private render(): void {
		if (this.expanded) {
			this.box.setContent(this.renderExpanded());
		} else {
			this.box.setContent(this.renderCompact());
		}
	}

	private renderCompact(): string {
		return `{bold}q{/bold}=quit  {bold}p{/bold}=pause  {bold}r{/bold}=resume  {bold}i{/bold}=inject  {bold}?{/bold}=help`;
	}

	private renderExpanded(): string {
		return [
			"{bold}Keyboard Controls:{/bold}",
			"",
			"  {bold}q{/bold} / {bold}Ctrl+C{/bold}  Quit the application",
			"  {bold}p{/bold}           Pause the workflow",
			"  {bold}r{/bold}           Resume the workflow",
			"  {bold}i{/bold}           Inject a message",
			"  {bold}?{/bold}           Toggle this help",
			"",
			"{gray-fg}Press ? to close{/gray-fg}",
		].join("\n");
	}
}
