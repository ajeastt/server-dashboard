package main

import "strconv"

func parseInt(s string, defaultVal int) int {
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

func round2(val float64) float64 {
	return float64(int(val*100)) / 100
}
