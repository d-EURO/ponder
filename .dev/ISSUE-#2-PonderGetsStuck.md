## Process node/ponder gets stuck in runtime

**Affected: All branches (?)**

#### What happened? What could be the issue?

Ponder indexer gets stuck and not responding anymore. it's possible that the "Equity:Delegation" code section is causing an infinite loop or a recursive update cycle that leads to resource exhaustion and causes the Ponder process to get stuck.

#### Posible code section

```
	const addParentDelegation = async (delegatedFrom: string | undefined, arrayToAdd: string[]) => {
		if (!delegatedFrom) return;

		const parentDelegation = await Delegation.upsert({
			id: delegatedFrom,
			create: {
				owner: delegatedFrom,
				pureDelegatedFrom: arrayToAdd,
			},
			update: ({ current }) => ({
				pureDelegatedFrom: current.pureDelegatedFrom.concat(
					arrayToAdd.filter((item) => current.pureDelegatedFrom.indexOf(item) < 0)
				),
			}),
		});

		addParentDelegation(parentDelegation.delegatedTo, arrayToAdd); // <<<<< <<<<< <<<<<
	};
```

#### Excluded code section, to don't crash ponder

```
	// await Delegation.update({
	//   id: event.args.from,
	//   data: {
	//     delegatedTo: event.args.to,
	//   },
	// });

	// addParentDelegation(event.args.to, arrayToUpdate);

	// await ActiveUser.upsert({
	//   id: event.args.from,
	//   create: {
	//     lastActiveTime: event.block.timestamp,
	//   },
	//   update: () => ({
	//     lastActiveTime: event.block.timestamp,
	//   }),
	// });
```

#### AI: Cody Analysis

Here's a potential scenario that could cause such an issue:

When the Equity:Delegation event is triggered, the code updates the Delegation table for the event.args.from address.
The commented-out code attempts to update the delegatedTo field in the Delegation table for event.args.from with event.args.to.
The addParentDelegation function is then called with event.args.to and arrayToUpdate (which contains event.args.from).
Inside addParentDelegation, if event.args.to has a delegation record, it might update the pureDelegatedFrom array for that record, adding event.args.from to it.
If the update to the pureDelegatedFrom array triggers another Equity:Delegation event (which is possible if there's a listener for changes to the Delegation table), it could cause the same code to run again, leading to a recursive loop.
This recursive loop could potentially continue indefinitely, with each iteration updating the Delegation table and triggering more events, eventually exhausting system resources like memory or CPU.

To prevent such issues, it's essential to carefully handle recursive updates and ensure that there are no infinite loops or cycles in the event handling logic. Some potential solutions could be:

Implement proper checks and guards to prevent recursive updates or infinite loops.
Use a queue or a job system to process events asynchronously, preventing recursive calls within the same event handler.
Implement rate-limiting or throttling mechanisms to prevent excessive updates or events from overwhelming the system.
Thoroughly test the event handling logic with various edge cases and scenarios to identify and fix any potential issues before deploying to production.
It's also worth noting that Ponder is designed to handle events efficiently, so if the issue persists even after implementing safeguards, it might be worth investigating if there are any underlying issues or inefficiencies in the event handling logic or the database operations.
