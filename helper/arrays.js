const findDifference = (arr1, arr2) => {
	return arr1.filter((x) => !arr2.includes(x));
};

const isDifferent = (arr1, arr2) => {
	return arr1.length !== arr2.length || findDifference(arr1, arr2).length > 0;
};

module.exports = {
	findDifference,
	isDifferent,
};
