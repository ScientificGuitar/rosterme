using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterMeApi.Migrations
{
    /// <inheritdoc />
    public partial class ScopeInviteLinksToEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InviteLinks_Organizations_OrganizationId",
                table: "InviteLinks");

            migrationBuilder.DropIndex(
                name: "IX_InviteLinks_OrganizationId",
                table: "InviteLinks");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "InviteLinks");

            migrationBuilder.AddColumn<Guid>(
                name: "EventId",
                table: "InviteLinks",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InviteLinks_EventId",
                table: "InviteLinks",
                column: "EventId");

            migrationBuilder.AddForeignKey(
                name: "FK_InviteLinks_Events_EventId",
                table: "InviteLinks",
                column: "EventId",
                principalTable: "Events",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InviteLinks_Events_EventId",
                table: "InviteLinks");

            migrationBuilder.DropIndex(
                name: "IX_InviteLinks_EventId",
                table: "InviteLinks");

            migrationBuilder.DropColumn(
                name: "EventId",
                table: "InviteLinks");

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "InviteLinks",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_InviteLinks_OrganizationId",
                table: "InviteLinks",
                column: "OrganizationId");

            migrationBuilder.AddForeignKey(
                name: "FK_InviteLinks_Organizations_OrganizationId",
                table: "InviteLinks",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
