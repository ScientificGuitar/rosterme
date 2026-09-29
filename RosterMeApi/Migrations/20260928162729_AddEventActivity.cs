using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterMeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddEventActivity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EventActivities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ActorClerkUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ActorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    VolunteerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SignupId = table.Column<Guid>(type: "uuid", nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventActivities_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EventActivities_Signups_SignupId",
                        column: x => x.SignupId,
                        principalTable: "Signups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventActivities_EventId_OccurredAt_Id",
                table: "EventActivities",
                columns: new[] { "EventId", "OccurredAt", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_EventActivities_SignupId",
                table: "EventActivities",
                column: "SignupId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EventActivities");
        }
    }
}
