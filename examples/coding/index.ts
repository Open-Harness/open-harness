/**
 * Two-Phase Coding Workflow
 *
 * Phase 1: Planning - Break PRD into tickets and validate them
 * Phase 2: Execution - Code and review each ticket until approved
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import * as p from "@clack/prompts";
import type { StepYield } from "@dao/sdk";
import { Agent, BaseHarness } from "@dao/sdk";

// ============================================
// Types
// ============================================

interface CodingState {
	phase: "planning" | "execution";

	// Phase 1: Planning
	prd: string;
	tickets: Ticket[];
	validationIterations: Record<string, ValidationFeedback[]>;
	allTicketsValidated: boolean;

	// Phase 2: Execution
	currentTicketIndex: number;
	ticketWorkHistory: Record<string, TicketWorkHistory>;
	completedTickets: string[];
}

interface Ticket {
	id: string;
	title: string;
	description: string;
	validated: boolean;
}

interface ValidationFeedback {
	feedback: string;
	approved: boolean;
}

interface TicketWorkHistory {
	codeIterations: CodeReviewPair[];
	completed: boolean;
}

interface CodeReviewPair {
	code: string;
	review: string;
	approved: boolean;
}

// Input/Output types for each phase
type PlanningInput =
	| { type: "prd"; content: string }
	| { type: "ticket"; ticket: Ticket; previousFeedback?: ValidationFeedback[] };
type PlanningOutput = { type: "tickets"; tickets: Ticket[] } | { type: "validation"; feedback: ValidationFeedback };

type ExecutionInput = { type: "ticket"; ticket: Ticket };
type ExecutionOutput = { type: "code"; code: string } | { type: "review"; review: string; approved: boolean };

type WorkflowInput = PlanningInput | ExecutionInput;
type WorkflowOutput = PlanningOutput | ExecutionOutput;

// ============================================
// Agents
// ============================================

class PlanningAgent extends Agent<CodingState, PlanningInput, PlanningOutput> {
	private async callLLM(prompt: string, sessionId: string): Promise<string> {
		let fullResponse = "";
		const stream = query({
			prompt,
			options: {
				model: "haiku",
				permissionMode: "bypassPermissions",
				allowDangerouslySkipPermissions: true,
			},
		});

		for await (const msg of stream) {
			if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
				for (const block of msg.message.content) {
					if (block.type === "text") {
						fullResponse += block.text;
					}
				}
			}
		}

		return fullResponse;
	}

	constructor() {
		super({
			name: "PlanningAgent",
			async run({ input, stepNumber, context }: { input: PlanningInput; stepNumber: number; context: CodingState }) {
				try {
					if (input.type === "prd") {
						// Break PRD into tickets using real LLM
						p.log.step(`Step ${stepNumber}: Breaking PRD into tickets...`);

						let fullResponse = "";
						await this.ticketGenerator.run({ prd: input.content }, `planning_${stepNumber}`, {
							callbacks: {
								onText: (text: string) => {
									fullResponse += text;
								},
							},
						});

						// Parse JSON response
						const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
						if (!jsonMatch) {
							throw new Error("Failed to parse tickets from LLM response");
						}

						const parsedTickets = JSON.parse(jsonMatch[0]) as Array<{
							id: string;
							title: string;
							description: string;
						}>;

						const tickets: Ticket[] = parsedTickets.map((t) => ({
							...t,
							validated: false,
						}));

						p.log.success(`Generated ${tickets.length} tickets from PRD`);

						return { type: "tickets", tickets };
					} else {
						// Validate ticket using real LLM
						p.log.step(`Step ${stepNumber}: Validating ticket ${input.ticket.id}...`);

						let fullResponse = "";
						await this.ticketValidator.run(
							{
								ticketId: input.ticket.id,
								ticketTitle: input.ticket.title,
								ticketDescription: input.ticket.description,
								previousFeedback: input.previousFeedback || [],
							},
							`validation_${input.ticket.id}_${stepNumber}`,
							{
								callbacks: {
									onText: (text: string) => {
										fullResponse += text;
									},
								},
							},
						);

						// Parse JSON response
						const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
						if (!jsonMatch) {
							throw new Error("Failed to parse validation from LLM response");
						}

						const parsed = JSON.parse(jsonMatch[0]) as {
							feedback: string;
							approved: boolean;
						};

						const feedback: ValidationFeedback = {
							feedback: parsed.feedback,
							approved: parsed.approved,
						};

						if (feedback.approved) {
							p.log.success(`Ticket ${input.ticket.id} validated`);
						} else {
							p.log.warn(`Ticket ${input.ticket.id} needs refinement`);
						}

						return { type: "validation", feedback };
					}
				} catch (error) {
					p.log.error(`Error in PlanningAgent: ${error instanceof Error ? error.message : String(error)}`);
					throw error;
				}
			},
		});
	}
}

class CodingAgent extends Agent<CodingState, ExecutionInput, ExecutionOutput> {
	private coder = createAgent({
		name: "Coder",
		prompt: `You are a coding agent. Your job is to implement features based on development tickets.

Given a ticket, write clean, well-structured code that implements the requirements. Return ONLY the code, no explanations or markdown formatting.

Ticket:
ID: {{ticketId}}
Title: {{ticketTitle}}
Description: {{ticketDescription}}

{{#if previousCode}}
Previous code attempt (if this is a revision):
\`\`\`
{{previousCode}}
\`\`\`
{{/if}}

{{#if reviewFeedback}}
Review feedback to address:
{{reviewFeedback}}
{{/if}}

Write the implementation code:`,
		model: "haiku",
	});

	constructor() {
		super({
			name: "CodingAgent",
			async run({ input, stepNumber, context }: { input: ExecutionInput; stepNumber: number; context: CodingState }) {
				try {
					const ticket = input.ticket;
					const state = context as CodingState;
					const workHistory = state.ticketWorkHistory[ticket.id];
					const lastIteration = workHistory?.codeIterations[workHistory.codeIterations.length - 1];

					p.log.step(`Step ${stepNumber}: Coding ticket ${ticket.id}...`);

					let fullResponse = "";
					await this.coder.run(
						{
							ticketId: ticket.id,
							ticketTitle: ticket.title,
							ticketDescription: ticket.description,
							previousCode: lastIteration?.code,
							reviewFeedback: lastIteration?.review,
						},
						`coding_${ticket.id}_${stepNumber}`,
						{
							callbacks: {
								onText: (text: string) => {
									fullResponse += text;
								},
							},
						},
					);

					// Extract code (remove markdown code blocks if present)
					let code = fullResponse.trim();
					const codeBlockMatch = code.match(/```(?:\w+)?\n?([\s\S]*?)```/);
					if (codeBlockMatch) {
						code = codeBlockMatch[1].trim();
					}

					p.log.info(`Generated code for ${ticket.id}`);

					return { type: "code", code };
				} catch (error) {
					p.log.error(`Error in CodingAgent: ${error instanceof Error ? error.message : String(error)}`);
					throw error;
				}
			},
		});
	}
}

class ReviewAgent extends Agent<CodingState, ExecutionInput, ExecutionOutput> {
	private reviewer = createAgent({
		name: "Reviewer",
		prompt: `You are a code review agent. Your job is to review code implementations and provide feedback.

Review the code against the ticket requirements. Check for:
- Correctness: Does it implement what the ticket asks for?
- Code quality: Is it clean, readable, and well-structured?
- Best practices: Does it follow good coding standards?

Ticket:
ID: {{ticketId}}
Title: {{ticketTitle}}
Description: {{ticketDescription}}

Code to review:
\`\`\`
{{code}}
\`\`\`

Return your response as JSON with this exact structure:
{
  "review": "Your detailed review feedback",
  "approved": true or false
}`,
		model: "haiku",
	});

	constructor() {
		super({
			name: "ReviewAgent",
			async run({ input, stepNumber, context }: { input: ExecutionInput; stepNumber: number; context: CodingState }) {
				try {
					const ticket = input.ticket;
					const state = context as CodingState;
					const workHistory = state.ticketWorkHistory[ticket.id];
					const lastIteration = workHistory?.codeIterations[workHistory.codeIterations.length - 1];

					if (!lastIteration || !lastIteration.code) {
						throw new Error("No code to review");
					}

					p.log.step(`Step ${stepNumber}: Reviewing code for ticket ${ticket.id}...`);

					let fullResponse = "";
					await this.reviewer.run(
						{
							ticketId: ticket.id,
							ticketTitle: ticket.title,
							ticketDescription: ticket.description,
							code: lastIteration.code,
						},
						`review_${ticket.id}_${stepNumber}`,
						{
							callbacks: {
								onText: (text: string) => {
									fullResponse += text;
								},
							},
						},
					);

					// Parse JSON response
					const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
					if (!jsonMatch) {
						throw new Error("Failed to parse review from LLM response");
					}

					const parsed = JSON.parse(jsonMatch[0]) as {
						review: string;
						approved: boolean;
					};

					if (parsed.approved) {
						p.log.success(`Ticket ${ticket.id} code approved`);
					} else {
						p.log.warn(`Ticket ${ticket.id} needs code revision`);
					}

					return { type: "review", review: parsed.review, approved: parsed.approved };
				} catch (error) {
					p.log.error(`Error in ReviewAgent: ${error instanceof Error ? error.message : String(error)}`);
					throw error;
				}
			},
		});
	}
}

// ============================================
// Harness
// ============================================

class TwoPhaseCodingHarness extends BaseHarness<CodingState, WorkflowInput, WorkflowOutput> {
	private planningAgent = new PlanningAgent();
	private codingAgent = new CodingAgent();
	private reviewAgent = new ReviewAgent();

	constructor(prd: string) {
		super({
			initialState: {
				phase: "planning",
				prd,
				tickets: [],
				validationIterations: {},
				allTicketsValidated: false,
				currentTicketIndex: 0,
				ticketWorkHistory: {},
				completedTickets: [],
			},
		});
	}

	async *execute(): AsyncGenerator<StepYield<WorkflowInput, WorkflowOutput>> {
		const state = this.state.getState();

		// Phase 1: Planning
		if (state.phase === "planning") {
			p.log.info("Starting Phase 1: Planning");

			// Step 1: Break PRD into tickets
			const context = this.loadContext();
			const ticketsOutput = await this.planningAgent.run({
				input: { type: "prd", content: state.prd },
				context: context.state,
				stepNumber: this.currentStep + 1,
				stepHistory: this.getStepHistory(),
				constraints: {},
			});

			if (ticketsOutput.type === "tickets") {
				this.state.updateState((s) => ({
					...s,
					tickets: ticketsOutput.tickets,
				}));
				yield { input: { type: "prd", content: state.prd }, output: ticketsOutput };
			}

			// Step 2: Validate each ticket (loop until all validated)
			const updatedState = this.state.getState();
			let allValidated = true;

			for (const ticket of updatedState.tickets) {
				if (ticket.validated) continue;

				allValidated = false;
				const previousFeedback = updatedState.validationIterations[ticket.id] || [];

				const validationContext = this.loadContext();
				const validationOutput = await this.planningAgent.run({
					input: { type: "ticket", ticket, previousFeedback },
					context: validationContext.state,
					stepNumber: this.currentStep + 1,
					stepHistory: this.getStepHistory(),
					constraints: {},
				});

				if (validationOutput.type === "validation") {
					const currentIterations = updatedState.validationIterations[ticket.id] || [];
					this.state.updateState((s) => {
						const newIterations = [...currentIterations, validationOutput.feedback];

						const updatedTickets = s.tickets.map((t) =>
							t.id === ticket.id ? { ...t, validated: validationOutput.feedback.approved } : t,
						);

						return {
							...s,
							validationIterations: {
								...s.validationIterations,
								[ticket.id]: newIterations,
							},
							tickets: updatedTickets,
						};
					});

					yield { input: { type: "ticket", ticket, previousFeedback }, output: validationOutput };

					// If not approved, we'll loop back to validate again
					if (!validationOutput.feedback.approved) {
						// Simulate ticket refinement
						this.state.updateState((s) => {
							const refinedTickets = s.tickets.map((t) =>
								t.id === ticket.id ? { ...t, description: `${t.description} (refined based on feedback)` } : t,
							);
							return { ...s, tickets: refinedTickets };
						});
					}
				}
			}

			// Check if all tickets are validated
			const finalPlanningState = this.state.getState();
			const allTicketsValidated = finalPlanningState.tickets.every((t) => t.validated);

			if (allTicketsValidated) {
				p.log.success("All tickets validated! Moving to execution phase.");
				this.state.updateState((s) => ({
					...s,
					phase: "execution",
					allTicketsValidated: true,
				}));
			} else {
				// Continue validation loop
				return;
			}
		}

		// Phase 2: Execution
		const executionState = this.state.getState();
		if (executionState.phase === "execution") {
			p.log.info("Starting Phase 2: Execution");

			const validatedTickets = executionState.tickets.filter((t) => t.validated);

			for (let i = executionState.currentTicketIndex; i < validatedTickets.length; i++) {
				const ticket = validatedTickets[i];
				const workHistory = executionState.ticketWorkHistory[ticket.id] || {
					codeIterations: [],
					completed: false,
				};

				// Initialize work history if needed
				if (!(ticket.id in executionState.ticketWorkHistory)) {
					this.state.updateState((s) => ({
						...s,
						ticketWorkHistory: {
							...s.ticketWorkHistory,
							[ticket.id]: workHistory,
						},
					}));
				}

				p.log.step(`Working on ticket ${ticket.id}: ${ticket.title}`);

				// Code → Review loop until approved
				let ticketCompleted = false;
				let iterationCount = 0;
				const maxIterations = 10; // Safety limit

				while (!ticketCompleted && iterationCount < maxIterations) {
					iterationCount++;
					const currentState = this.state.getState();
					const currentWorkHistory = currentState.ticketWorkHistory[ticket.id]!;
					const lastIteration = currentWorkHistory.codeIterations[currentWorkHistory.codeIterations.length - 1];

					// Check if we need to generate code or review existing code
					const needsCode = !lastIteration || (lastIteration.review && !lastIteration.approved);

					if (needsCode) {
						// Generate code
						const execContext = this.loadContext();
						const codeOutput = await this.codingAgent.run({
							input: { type: "ticket", ticket },
							context: execContext.state,
							stepNumber: this.currentStep + 1,
							stepHistory: this.getStepHistory(),
							constraints: {},
						});

						if (codeOutput.type === "code") {
							yield { input: { type: "ticket", ticket }, output: codeOutput };

							// Store code (will be reviewed next iteration)
							this.state.updateState((s) => {
								const history = s.ticketWorkHistory[ticket.id] || {
									codeIterations: [],
									completed: false,
								};
								history.codeIterations.push({
									code: codeOutput.code,
									review: "",
									approved: false,
								});
								return {
									...s,
									ticketWorkHistory: {
										...s.ticketWorkHistory,
										[ticket.id]: history,
									},
								};
							});
						}
					} else {
						// Review the code
						const reviewContext = this.loadContext();
						const reviewOutput = await this.reviewAgent.run({
							input: { type: "ticket", ticket },
							context: reviewContext.state,
							stepNumber: this.currentStep + 1,
							stepHistory: this.getStepHistory(),
							constraints: {},
						});

						if (reviewOutput.type === "review") {
							yield { input: { type: "ticket", ticket }, output: reviewOutput };

							// Update work history with review
							this.state.updateState((s) => {
								const history = s.ticketWorkHistory[ticket.id] || {
									codeIterations: [],
									completed: false,
								};
								const lastIter = history.codeIterations[history.codeIterations.length - 1];
								if (lastIter) {
									lastIter.review = reviewOutput.review;
									lastIter.approved = reviewOutput.approved;
								}
								return {
									...s,
									ticketWorkHistory: {
										...s.ticketWorkHistory,
										[ticket.id]: history,
									},
								};
							});

							if (reviewOutput.approved) {
								ticketCompleted = true;
								p.log.success(`Ticket ${ticket.id} completed!`);

								this.state.updateState((s) => {
									const history = s.ticketWorkHistory[ticket.id] || {
										codeIterations: [],
										completed: false,
									};
									history.completed = true;
									return {
										...s,
										ticketWorkHistory: {
											...s.ticketWorkHistory,
											[ticket.id]: history,
										},
										completedTickets: [...s.completedTickets, ticket.id],
										currentTicketIndex: i + 1,
									};
								});
							}
						}
					}
				}

				if (!ticketCompleted) {
					p.log.warn(`Ticket ${ticket.id} reached max iterations without completion`);
				}
			}
		}
	}

	override isComplete(): boolean {
		const state = this.state.getState();

		if (state.phase === "planning") {
			return state.allTicketsValidated;
		}

		if (state.phase === "execution") {
			return state.completedTickets.length === state.tickets.filter((t) => t.validated).length;
		}

		return false;
	}
}

// ============================================
// Main
// ============================================

async function main() {
	p.intro("Two-Phase Coding Workflow");

	const prd = `
Build a user management system with the following features:
1. User authentication (login/signup)
2. User dashboard with statistics
3. Data export functionality
	`.trim();

	p.log.info("Starting workflow with PRD:");
	p.log.info(prd);

	const harness = new TwoPhaseCodingHarness(prd);

	try {
		await harness.run();

		const finalState = harness.getState();

		p.log.success("\n=== Workflow Complete ===");
		p.log.info(`Phase: ${finalState.phase}`);
		p.log.info(
			`Tickets validated: ${finalState.tickets.filter((t) => t.validated).length}/${finalState.tickets.length}`,
		);
		p.log.info(
			`Tickets completed: ${finalState.completedTickets.length}/${finalState.tickets.filter((t) => t.validated).length}`,
		);

		if (finalState.completedTickets.length > 0) {
			p.log.info("\nCompleted tickets:");
			for (const ticketId of finalState.completedTickets) {
				const ticket = finalState.tickets.find((t) => t.id === ticketId);
				const history = finalState.ticketWorkHistory[ticketId];
				if (ticket && history) {
					p.log.info(`  - ${ticket.id}: ${ticket.title} (${history.codeIterations.length} iterations)`);
				}
			}
		}

		p.outro("Workflow execution finished successfully!");
	} catch (error) {
		p.cancel("Workflow failed");
		p.log.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

if (import.meta.main) {
	main().catch((error) => {
		p.cancel("Fatal error");
		p.log.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
