inspector = new PreactTreeInspector(app.__k)
buy_order = [
	"geiger_counter",
	"air_quality_monitor",
	"scrap_buyback_station",
	"small_recycler",
	"moss_filter",
	"wheelbarrow",
	"wood_generator",
	"groundskeeper",
	"research_lab",
	"wildflower_patch", // 5000
	"lavender_patch", //   5000
	"sunflower_patch", //  6000
	"oak_sapling", //      8000
	"windmill", //        15000

]
inspector.find(node => node.kind == "memo" && node.key !== null).filter(v => {
	if (v.props.children.props.class == "_metric_1sd5w_16") return false
	return true
}).map(v => {
	return v.props.title
})
if (window.cint) clearInterval(cint)
cint = setInterval(function () {
	inspector.scan()
	for (const target_key of buy_order) {
		const res = inspector.find(node => node.key === target_key)
		if (res.length > 0) {
			// spell:ignore _4jenx_90
			res[0].dom.querySelector("._actionBtn_4jenx_90").click()
			break
		}
	}
}, 50)
