interface Module {
	name: string
	type: "script" | "library" | "utility" | "data" | "test"
	isEmpty?: boolean
	dependsOn?: string[] // names of other modules this one depends on
}

// List of all modules with dependencies
export const modules: Module[] = [
]
