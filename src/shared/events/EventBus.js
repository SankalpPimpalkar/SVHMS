
class EventBus {
    #events = {}

    on(event, handler) {
        if (!this.#events[event]) {
            this.#events[event] = []
        }
        this.#events[event].push(handler)
    }

    async emit(event, payload) {
        const handlers = this.#events[event] || []
        for (const handler of handlers) {
            await handler(payload)
        }
    }
}

const eventBus = new EventBus()
export default eventBus