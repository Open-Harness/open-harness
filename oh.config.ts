import { claudePack, corePack } from "@open-harness/kernel";
import {
	mockClaudePack,
	tutorialPack,
} from "./packages/kernel-tutorial/src/packs/tutorial-pack.ts";

export const nodePacks = {
	core: corePack,
	// For tutorials, use mockClaudePack to avoid live API calls
	// For live testing, switch to claudePack
	claude: mockClaudePack,
	tutorial: tutorialPack,
};
