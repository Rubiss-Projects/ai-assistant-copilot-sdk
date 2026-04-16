export class CommandRouter {
    handlers = new Map();
    register(name, handler) {
        this.handlers.set(name, handler);
    }
    async dispatch(interaction, context) {
        const handler = this.handlers.get(interaction.commandName);
        if (handler) {
            await handler(interaction, context);
        }
        else {
            console.warn(`Unknown command: ${interaction.commandName}`);
        }
    }
}
