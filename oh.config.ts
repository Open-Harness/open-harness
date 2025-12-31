import { claudePack, corePack } from "@open-harness/kernel";
import { tutorialPack } from "./packages/kernel-tutorial/src/packs/tutorial-pack.ts";

export const nodePacks = {
	core: corePack,
	claude: claudePack,
	tutorial: tutorialPack,
};
