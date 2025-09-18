package lodash

func Include[T any](collection []T, iteratee func(item T, index int) bool) bool {
	// result := make([]R, len(collection))

	// var wg sync.WaitGroup
	// wg.Add(len(collection))

	for i, item := range collection {
		res := iteratee(item, i)

		if res {
			return true
		}
		// result[_i] = res

		// wg.Done()
	}

	// wg.Wait()

	return false
}
