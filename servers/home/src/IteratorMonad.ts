type IteratorOf<T> = T extends { [Symbol.iterator](): infer J } ? J : never;

export class IteratorMonad<T> {
	value: T;

	constructor(iterator: T) {
		this.value = iterator;
	}

	skip<
		T,
		I extends Iterator<T, { t: "TReturn" }, { t: "TNext" }>
	>(this: IteratorMonad<I>, count: number) {
		const v: I = this.value;
		for (let i = 0; i < count; i++) {
			const iter_res = v.next();
			if (iter_res.done) {
				console.log(iter_res.value)
				break
			}
		}
		return this;
	}

	toArray(this: IteratorMonad<IterableIterator<T>>): T[] {
		return Array.from(this.value);
	}

	static from<R extends { [Symbol.iterator](): W }, W = IteratorOf<R>>(obj: R) {
		return new IteratorMonad(obj[Symbol.iterator]());
	}
}
export class M<T> {
	value: T;
	constructor(value: T) {
		this.value = value
	}
	static new() {
		return new this(window)
	}
	key(str: keyof T) {
		return new M(this.value[str])
	}
	path(js_path: string) {
		const parts = js_path.split(".")
		let v = this.value
		for (const part of parts) {
			v = v[part as keyof T] as T;
		}
		this.value = v
		return this
	}
	convert_to<U>(cls: {
		from(value: T): U
	}) {
		return cls.from(this.value)
	}
}
