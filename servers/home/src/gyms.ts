import { NS } from "../@ns";

type Compute<T> = { [K in keyof T]: T[K] } & {};
type RW<T> = { -readonly [R in keyof T]: RW<T[R]> } & {};
function rw<T>(x: T): RW<T> {
	return x;
}
type Slice<
	T extends unknown[],
	Start extends number = 0,
	End extends number = T["length"],
	I extends unknown[] = [],
	Acc extends unknown[] = [],
> = T extends [infer First, ...infer Rest] ? I["length"] extends End ? Acc
	: I["length"] extends Start
		? Slice<Rest, Start, End, [...I, unknown], [...Acc, First]>
	: Acc extends [] ? Slice<Rest, Start, End, [...I, unknown], Acc>
	: Slice<Rest, Start, End, [...I, unknown], [...Acc, First]>
	: Acc;

enum LocationType {
	Company = "Company",
	Gym = "Gym",
	Hospital = "Hospital",
	Slums = "Slums",
	Special = "Special",
	StockMarket = "Stock Market",
	TechVendor = "Tech Vendor",
	TravelAgency = "Travel Agency",
	University = "University",
	Casino = "Casino",
}

export async function main(ns: NS) {
	const {
		UniversityClassType: {
			computerScience,
			dataStructures,
			networks,
			algorithms,
		},
		GymType: { strength },
		CompanyName,
		JobName,
		JobField,
		FactionName,
		CityName,
		LocationName,
	} = ns.enums;
	const JobTracks = rw(
		{
			[JobField.software]: [
				JobName.software0,
				JobName.software1,
				JobName.software2,
				JobName.software3,
				JobName.software4,
				JobName.software5,
				JobName.software6,
				JobName.software7,
			],
			[JobField.softwareConsultant]: [
				JobName.softwareConsult0,
				JobName.softwareConsult1,
			],
			[JobField.it]: [JobName.IT0, JobName.IT1, JobName.IT2, JobName.IT3],
			[JobField.securityEngineer]: [JobName.securityEng],
			[JobField.networkEngineer]: [
				JobName.networkEng0,
				JobName.networkEng1,
			],
			[JobField.business]: [
				JobName.business0,
				JobName.business1,
				JobName.business2,
				JobName.business3,
				JobName.business4,
				JobName.business5,
			],
			[JobField.businessConsultant]: [
				JobName.businessConsult0,
				JobName.businessConsult1,
			],
			[JobField.security]: [
				JobName.security0,
				JobName.security1,
				JobName.security2,
				JobName.security3,
			],
			[JobField.agent]: [JobName.agent0, JobName.agent1, JobName.agent2],
			[JobField.employee]: [JobName.employee],
			[JobField.partTimeEmployee]: [JobName.employeePT],
			[JobField.waiter]: [JobName.waiter],
			[JobField.partTimeWaiter]: [JobName.waiterPT],
		} as const,
	);
	const softwareJobs = JobTracks[JobField.software];
	const itJobs = JobTracks[JobField.it];
	const netEngJobs = JobTracks[JobField.networkEngineer];
	const businessJobs = JobTracks[JobField.business];
	const securityJobs = JobTracks[JobField.security];
	const agentJobs = JobTracks[JobField.agent];
	const softwareConsultJobs = JobTracks[JobField.softwareConsultant];
	const businessConsultJobs = JobTracks[JobField.businessConsultant];
	const allTechJobs = rw(
		[
			...softwareJobs,
			...itJobs,
			...netEngJobs,
			JobName.securityEng,
		] as const,
	);
	const softwareJobsToHeadOfEng = softwareJobs.slice(0, 6) as Slice<
		typeof softwareJobs,
		0,
		6
	>;
	const softwareJobsToLeadDev = softwareJobs.slice(0, 4) as Slice<
		typeof softwareJobs,
		0,
		4
	>;
	const businessJobToOpsManager = businessJobs.slice(0, 4) as Slice<
		typeof businessJobs,
		0,
		4
	>;
	ns.tprint(JSON.stringify(
		{
			map: rw(
				[
					{
						city: CityName.Sector12,
						expMult: 1,
						costMult: 1,
						name: LocationName.Sector12IronGym,
						types: [LocationType.Gym],
					},
					{
						city: CityName.Aevum,
						costMult: 3,
						expMult: 2,
						name: LocationName.AevumCrushFitnessGym,
						types: [LocationType.Gym],
					},
					{
						city: CityName.Volhaven,
						costMult: 7,
						expMult: 4,
						name: LocationName.VolhavenMilleniumFitnessGym,
						types: [LocationType.Gym],
					},
					{
						city: CityName.Aevum,
						costMult: 10,
						expMult: 5,
						name: LocationName.AevumSnapFitnessGym,
						types: [LocationType.Gym],
					},
					{
						city: CityName.Sector12,
						costMult: 20,
						expMult: 10,
						name: LocationName.Sector12PowerhouseGym,
						types: [LocationType.Gym],
					},
					{
						city: CityName.Sector12,
						costMult: 3,
						expMult: 2,
						name: LocationName.Sector12RothmanUniversity,
						types: [LocationType.University],
					},
					{
						city: CityName.Aevum,
						costMult: 4,
						expMult: 3,
						name: LocationName.AevumSummitUniversity,
						types: [LocationType.University],
					},
					{
						city: CityName.Volhaven,
						costMult: 5,
						expMult: 4,
						name: LocationName.VolhavenZBInstituteOfTechnology,
						types: [LocationType.University],
					},
				] as const,
			),
			summitUni: {
				[computerScience]: 1.95625 as const,
				[dataStructures]: 3.9125 as const,
				[networks]: 7.825 as const,
				[algorithms]: 15.649 as const,
			},
			rothmanUni: {
				[computerScience]: 1.304 as const,
			},
			ironGym: {
				[strength]: 1.304 as const,
			},
			crushFitnessGym: 2.608 as const,
			milleniumFitnessGym: 5.216 as const,
			snapFitnessGym: 6.52 as const,
			powerhouseGym: 13.041 as const,
			[CompanyName.ECorp]: {
				name: CompanyName.ECorp,
				companyPositions: [
					...allTechJobs,
					...businessJobs,
					...securityJobs,
				],
				expMultiplier: 3,
				salaryMultiplier: 3,
				jobStatReqOffset: 249,
				relatedFaction: FactionName.ECorp,
			},
			[CompanyName.DefComm]: {
				name: CompanyName.DefComm,
				companyPositions: [
					JobName.business5,
					...allTechJobs,
					...softwareConsultJobs,
					...businessConsultJobs,
				],
				expMultiplier: 1.75,
				salaryMultiplier: 1.75,
				jobStatReqOffset: 199,
			},
			[CompanyName.CIA]: {
				name: CompanyName.CIA,
				companyPositions: [
					...softwareJobsToHeadOfEng,
					...netEngJobs,
					JobName.securityEng,
					...itJobs,
					...securityJobs,
					...agentJobs,
				],
				expMultiplier: 2,
				salaryMultiplier: 2,
				jobStatReqOffset: 149,
			},
			[CompanyName.NetLinkTechnologies]: {
				name: CompanyName.NetLinkTechnologies,
				companyPositions: [...allTechJobs],
				expMultiplier: 1.2,
				salaryMultiplier: 1.2,
				jobStatReqOffset: 99,
			},
			[CompanyName.Police]: {
				name: CompanyName.Police,
				companyPositions: [...securityJobs, ...softwareJobsToLeadDev],
				expMultiplier: 1.3,
				salaryMultiplier: 1.3,
				jobStatReqOffset: 99,
			},
			[CompanyName.LexoCorp]: {
				name: CompanyName.LexoCorp,
				companyPositions: [
					...allTechJobs,
					...softwareConsultJobs,
					...businessJobs,
					...securityJobs,
				],
				expMultiplier: 1.4,
				salaryMultiplier: 1.4,
				jobStatReqOffset: 99,
			},
			[CompanyName.AlphaEnterprises]: {
				name: CompanyName.AlphaEnterprises,
				companyPositions: [
					...softwareJobsToLeadDev,
					...businessJobToOpsManager,
					...softwareConsultJobs,
				],
				expMultiplier: 1.5,
				salaryMultiplier: 1.5,
				jobStatReqOffset: 99,
			},
			[CompanyName.OmegaSoftware]: {
				name: CompanyName.OmegaSoftware,
				companyPositions: [
					...softwareJobs,
					...softwareConsultJobs,
					...itJobs,
				],
				expMultiplier: 1.1,
				salaryMultiplier: 1.1,
				jobStatReqOffset: 49,
			},
			[CompanyName.CompuTek]: {
				name: CompanyName.CompuTek,
				companyPositions: [...allTechJobs],
				expMultiplier: 1.2,
				salaryMultiplier: 1.2,
				jobStatReqOffset: 74,
			},
			[CompanyName.CarmichaelSecurity]: {
				name: CompanyName.CarmichaelSecurity,
				companyPositions: [
					...allTechJobs,
					...softwareConsultJobs,
					...agentJobs,
					...securityJobs,
				],
				expMultiplier: 1.2,
				salaryMultiplier: 1.2,
				jobStatReqOffset: 74,
			},
			[CompanyName.RhoConstruction]: {
				name: CompanyName.RhoConstruction,
				companyPositions: [
					...softwareJobsToLeadDev,
					...businessJobToOpsManager,
				],
				expMultiplier: 1.3,
				salaryMultiplier: 1.3,
				jobStatReqOffset: 49,
			},
			[CompanyName.FoodNStuff]: {
				name: CompanyName.FoodNStuff,
				companyPositions: [JobName.employee, JobName.employeePT],
				expMultiplier: 1,
				salaryMultiplier: 1,
				jobStatReqOffset: 0,
			},
			[CompanyName.JoesGuns]: {
				name: CompanyName.JoesGuns,
				companyPositions: [JobName.employee, JobName.employeePT],
				expMultiplier: 1,
				salaryMultiplier: 1,
				jobStatReqOffset: 0,
			},
			[CompanyName.NoodleBar]: {
				name: CompanyName.NoodleBar,
				companyPositions: [JobName.waiter, JobName.waiterPT],
				expMultiplier: 1,
				salaryMultiplier: 1,
				jobStatReqOffset: 0,
			},
		},
		void 0,
		2,
	));
}
